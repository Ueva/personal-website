# frozen_string_literal: true
require 'date'
require 'yaml'
require 'json'
require 'cgi'
require 'uri'
require 'tmpdir'
require 'fileutils'
require 'digest'
require 'optparse'
require 'net/http'
require 'jekyll'
require 'bibtex'
require 'nokogiri'

ROOT = File.expand_path('..', __dir__)
TYPES = %w[conference journal workshop preprint].freeze

def check(condition, message)
  raise message unless condition
end

def mapping(value, label)
  check(value.is_a?(Hash), "#{label}: expected a mapping")
end

def fields(value, required, allowed, label)
  mapping(value, label)
  required.each do |key|
    check(value[key].is_a?(String) && !value[key].strip.empty?, "#{label}: #{key} must be a non-empty string")
  end
  check((value.keys - allowed).empty?, "#{label}: unknown fields #{value.keys - allowed}")
end

def date(value, label)
  check(value.is_a?(String) || value.is_a?(Date), "#{label}: expected an ISO date")
  check(value.to_s.match?(/\A\d{4}-\d{2}-\d{2}\z/), "#{label}: use YYYY-MM-DD")
  Date.iso8601(value.to_s)
rescue ArgumentError
  raise "#{label}: invalid date #{value.inspect}"
end

def optional_url(value, label)
  return if value.nil? || value == ''
  check(value.is_a?(String), "#{label}: expected a URL string")
  check(value.match?(%r{\Ahttps?://\S+\z}) || value.start_with?('/'), "#{label}: use an https:// URL or root-relative path")
  if value.start_with?('/') && !value.start_with?('//')
    path = URI::DEFAULT_PARSER.unescape(value.split(/[?#]/).first)
    resolved = File.expand_path('.' + path, ROOT)
    check(resolved.start_with?(ROOT + File::SEPARATOR), "#{label}: path leaves the site")
    check(File.file?(resolved), "#{label}: missing local file #{path}")
  end
end

def yaml(path)
  # Psych otherwise silently accepts duplicate mapping keys.
  inspect_node = lambda do |node|
    if node.is_a?(Psych::Nodes::Mapping)
      keys = node.children.each_slice(2).map { |key, _| key.value }
      check(keys.uniq.size == keys.size, "#{path}: duplicate YAML keys")
    end
    node.children&.each { |child| inspect_node.call(child) } if node.respond_to?(:children)
  end
  inspect_node.call(Psych.parse_file(path))
  YAML.safe_load_file(path, permitted_classes: [Date])
end

def validate_data
  Dir['_data/**/*.{yaml,yml}'].each { |path| yaml(path) }
  keys = []
  Dir['_data/papers/*.yaml'].each do |path|
    paper = yaml(path)
    fields(paper, %w[title type description reference bibtex], %w[title type date description reference bibtex paper preprint supplement code], path)
    check(TYPES.include?(paper['type']), "#{path}: unknown publication type")
    date(paper['date'], "#{path} date")
    main = paper['type'] == 'preprint' ? 'preprint' : 'paper'
    check(paper[main].is_a?(String) && !paper[main].empty?, "#{path}: missing #{main} URL")
    %w[paper preprint supplement code].each { |key| optional_url(paper[key], "#{path} #{key}") }
    bibliography = BibTeX.parse(paper['bibtex'])
    check(bibliography.errors.empty? && bibliography.entries.size == 1, "#{path}: expected one valid BibTeX entry")
    entry = bibliography.entries.values.first
    %i[author title year].each { |field| check(entry[field] && !entry[field].to_s.empty?, "#{path}: BibTeX missing #{field}") }
    check(!keys.include?(entry.key), "#{path}: duplicate citation key #{entry.key}")
    keys << entry.key
  end
  config = yaml('_config.yaml')
  fields(config.fetch('author'), %w[name affiliation affiliation_url job_title email professional_email lab_name lab_url], %w[name affiliation affiliation_url job_title email professional_email lab_name lab_url], 'author')
  optional_url(config['image'], 'site image')
  groups = yaml('_data/publication_groups.yaml')
  check(groups.is_a?(Array), 'publication_groups must be a list')
  types = groups.flat_map do |group|
    fields(group, ['title'], %w[title types], 'publication_groups')
    check(group['types'].is_a?(Array), 'Each publication group needs a types list')
    group['types']
  end
  check(types.sort == TYPES.sort, 'Publication groups must cover each type once')
  Dir['_data/news/*.yaml'].each do |path|
    item = yaml(path)
    fields(item, ['text'], %w[date text], path)
    date(item['date'], path)
  end
  Dir['_data/software/*.yml'].each do |path|
    item = yaml(path)
    fields(item, %w[title description url], %w[title description url], path)
    optional_url(item['url'], path)
  end
  %w[project phd].each do |kind|
    path = "_data/#{kind}_students.yaml"
    data = yaml(path)
    mapping(data, path)
    check(data['students'].is_a?(Array), "#{path}: students must be a list")
    data['students'].each_with_index do |student, index|
      label = "#{path} entry #{index + 1}"
      if kind == 'project'
        fields(student, %w[name degree thesis], %w[name year degree thesis url], label)
        check(student['year'].is_a?(Integer), "#{label}: year must be an integer")
      else
        fields(student, %w[name start_date], %w[name qualification start_date end_date topics thesis_title thesis_link url role], label)
        start = date(student['start_date'], label)
        unless student['end_date'].nil? || student['end_date'] == ''
          finish = date(student['end_date'], label)
          check(finish >= start, "#{label}: end_date precedes start_date")
        end
        if student.key?('topics')
          check(student['topics'].is_a?(Array) && student['topics'].all? { |topic| topic.is_a?(String) && !topic.strip.empty? }, "#{label}: topics must be a list of non-empty strings")
        end
        %w[qualification thesis_title role].each do |key|
          check(student[key].is_a?(String), "#{label}: #{key} must be a string") if student.key?(key)
        end
        optional_url(student['thesis_link'], label)
        check(!student['thesis_link'] || student['thesis_link'] == '' || student['thesis_title'].to_s.strip != '', "#{label}: thesis_link requires thesis_title")
      end
      optional_url(student['url'], label)
    end
  end
  availability = yaml('_data/doctoral_supervision.yaml')
  fields(availability, %w[open_message closed_message], %w[accepting_students open_message closed_message opportunities], 'doctoral_supervision')
  check([true, false].include?(availability['accepting_students']), 'accepting_students must be a boolean')
  check(availability['opportunities'].is_a?(Array), 'opportunities must be a list')
  availability['opportunities'].each do |item|
    fields(item, %w[title url], %w[title url], 'doctoral opportunity')
    optional_url(item['url'], 'doctoral opportunity')
  end
  quotes = yaml('_data/quotes.yaml')
  check(quotes.is_a?(Array) && !quotes.empty?, 'quotes must be a non-empty list')
  quotes.each { |quote| fields(quote, %w[text author], %w[text author], 'quote') }
  profiles = yaml('_data/profiles.yaml')
  check(profiles.is_a?(Array), 'profiles must be a list')
  profiles.each do |profile|
    fields(profile, %w[id label username url], %w[id label username url footer], 'profile')
    optional_url(profile['url'], 'profile')
    check([true, false].include?(profile['footer']), 'profile footer must be a boolean') if profile.key?('footer')
  end
  check(profiles.map { |profile| profile['id'] }.uniq.size == profiles.size, 'Duplicate profile IDs')
end

# Focused checks for the site's ordinary file URLs, not a general-purpose HTML/CSS validator.
def validate_reference(raw, source, destination, ids)
  url = CGI.unescapeHTML(raw).strip
  check(!url.empty?, "#{source}: empty local URL")
  return if url.match?(%r{\A(?:[a-z][a-z0-9+.-]*:|//)}i)
  pathname, fragment = url.split('#', 2)
  pathname = URI::DEFAULT_PARSER.unescape(pathname.to_s.split('?').first.to_s)
  target = if pathname.empty?
             source
           elsif pathname.start_with?('/')
             File.join(destination, pathname.delete_prefix('/'))
           else
             File.expand_path(pathname, File.dirname(source))
           end
  target = File.join(target, 'index.html') if File.directory?(target)
  check(File.file?(target), "#{source}: broken local link #{url}")
  check(!fragment || !ids.key?(target) || ids[target].include?(URI::DEFAULT_PARSER.unescape(fragment)), "#{source}: missing anchor #{url}")
end

def validate_output(destination)
  files = Dir[File.join(destination, '**', '*.html')]
  documents = files.to_h { |path| [path, Nokogiri::HTML5.parse(File.read(path), max_errors: 100)] }
  ids = documents.transform_values { |document| document.css('[id]').map { |node| node['id'] } }
  documents.each do |path, document|
    check(ids[path].uniq.size == ids[path].size, "#{path}: duplicate IDs")
    # Verification files and disposable asset fixtures are intentionally fragments.
    if document.at_css('main')
      check(document.errors.empty?, "#{path}: invalid HTML: #{document.errors.join('; ')}")
      check(document.css('h1').size == 1 && !document.at_css('h1').text.strip.empty?, "#{path}: expected one non-empty page heading")
      check(document.css('script[src]:not([defer]):not([async])').empty?, "#{path}: external scripts must not block rendering")
    end
    document.css('script[type="application/ld+json"], script[type="application/json"]').each { |script| JSON.parse(script.content) }
    document.css('[href], [src]').each do |node|
      %w[href src].each { |attribute| validate_reference(node[attribute], path, destination, ids) if node.key?(attribute) }
    end
    # Our srcset values use ordinary file URLs followed by width/density descriptors.
    document.css('[srcset]').each do |node|
      node['srcset'].split(',').each { |candidate| validate_reference(candidate.strip.split.first.to_s, path, destination, ids) }
    end
    document.css('link[rel="stylesheet"]').each do |link|
      check(link['href'].include?('?v='), "#{path}: stylesheet needs a build version") if link['href'].include?('/assets/css/main.css')
    end
  end
  Dir[File.join(destination, '**', '*.css')].each do |path|
    File.read(path).scan(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)/).each do |values|
      validate_reference(values.compact.first, path, destination, ids)
    end
  end
  Dir[File.join(destination, '**', '*.xml')].each do |path|
    Nokogiri::XML(File.read(path)) { |options| options.strict.nonet }
  end
end

def text(value)
  value.to_s.gsub(/\s+/, ' ').strip
end

def content(node, selector, label)
  matches = node.css(selector)
  check(matches.size == 1 && !text(matches.first.text).empty?, "#{label}: missing or empty #{selector}")
  matches.first
end

# Assert visible content, not just valid markup or working URLs. Featured copy stays manual.
def validate_home(document, data)
  featured = content(document, '#featured-paper', 'Homepage')
  %w[h3 .featured-title .featured-summary .card-actions a.button].each do |selector|
    content(featured, selector, 'Featured Paper')
  end
  check(!featured.at_css('a.button')['href'].to_s.strip.empty?, 'Featured Paper: missing paper URL')
  recent = content(document, '#recent-news', 'Homepage')
  content(recent, 'a.button', 'Recent News')
  latest = data['news'].values.max_by { |item| item['date'].to_s }
  if latest
    check(text(recent.text).include?(text(Nokogiri::HTML5.fragment(latest['text']).text)), 'Recent News: latest item missing')
    check(recent.text.include?(Date.parse(latest['date'].to_s).strftime('%B %Y')), 'Recent News: date missing')
  end
  quote = content(document, '#quote-card', 'Homepage')
  initial = content(quote, '#quote-text', 'Quote of the Moment')
  author = content(quote, '#quote-author', 'Quote of the Moment')
  payload = JSON.parse(content(quote, '#quotes-data', 'Quote of the Moment').content)
  check(payload.size == data['quotes'].size, 'Quotes: entries lost from JSON')
  check(text(initial.text) == text(Nokogiri::HTML5.fragment(payload.first['html']).text), 'Quotes: initial content differs from rotation')
  check(text(author.text).include?(data['quotes'].first['author']), 'Quotes: initial author missing')
end

def validate_content(site, documents)
  site.pages.select { |page| %w[page default].include?(page.data['layout']) && page.url.match?(%r{(?:/|\.html)\z}) }.each do |page|
    document = documents.fetch(page.url)
    check(document.css('main h1').size == 1, "#{page.url}: page heading missing")
    content(document, 'title', page.url)
    description = document.at_css('meta[name="description"]')&.[]('content')
    check(!description.to_s.strip.empty?, "#{page.url}: missing description")
    check(document.at_css('link[rel="canonical"]')&.[]('href') == site.config['url'] + page.url, "#{page.url}: incorrect canonical URL")
    identity = JSON.parse(document.at_css('script[type="application/ld+json"]').content)['@graph'].find { |item| item['@type'] == 'Person' }
    check(identity && identity['name'] == site.config['author']['name'] && identity['jobTitle'] == site.config['author']['job_title'], "#{page.url}: identity metadata differs from configuration")
    expected = site.pages.select { |item| item.data['nav_order'] }.sort_by { |item| item.data['nav_order'] }
    actual = document.css('#site-nav a').map { |link| [text(link.text), link['href']] }
    check(actual == expected.map { |item| [item.data['nav_title'] || item.data['title'], item.url] }, "#{page.url}: navigation differs from page definitions")
  end
  validate_home(documents.fetch('/'), site.data)
  # Every data entry must survive rendering, including the editable details and citations.
  publications = documents.fetch('/publications.html').css('article.publication')
  papers = site.data['papers'].values
  check(publications.size == papers.size, 'Publications: entries lost or duplicated')
  papers.each do |paper|
    card = publications.find { |item| text(item.at_css('h3')&.text) == text(paper['title']) }
    check(card, "Publications: missing #{paper['title']}")
    check(text(card.text).include?(text(Nokogiri::HTML5.fragment(paper['description']).text)), "#{paper['title']}: description missing")
    check(card.at_css('textarea')&.text&.strip == paper['bibtex'].strip, "#{paper['title']}: citation changed or missing")
    expected_url = paper[paper['type'] == 'preprint' ? 'preprint' : 'paper']
    check(card.at_css('a.primary')&.[]('href') == expected_url, "#{paper['title']}: primary PDF link differs from data")
    check(text(card.at_css('time')&.text) == Date.parse(paper['date'].to_s).strftime('%B %Y'), "#{paper['title']}: publication date differs from data")
  end
  { 'project' => ['/supervision.html', '.student-entry', 'thesis'], 'phd' => ['/phds.html', '.doctoral-student', 'thesis_title'] }.each do |kind, (url, selector, thesis)|
    entries = site.data["#{kind}_students"]['students']
    cards = documents.fetch(url).css(selector)
    check(cards.size == entries.size, "#{kind} supervision: entries lost or duplicated")
    entries.each do |student|
      card = cards.find { |item| text(item.text).include?(student['name']) && text(item.text).include?(text(student[thesis])) }
      check(card, "#{kind} supervision: missing name or thesis for #{student['name']}")
      Array(student['topics']).each { |topic| check(text(card.text).include?(topic), "#{student['name']}: missing topic #{topic}") }
    end
  end
  availability = site.data['doctoral_supervision']
  message = availability[availability['accepting_students'] ? 'open_message' : 'closed_message']
  check(text(documents.fetch('/phds.html').text).include?(text(message)), 'Configured availability notice missing')
  site.data['software'].each_value do |project|
    check(text(documents.fetch('/software.html').text).include?(text(project['description'])), "Software: missing #{project['title']}")
  end
  site.data['news'].each_value do |item|
    check(text(documents.fetch('/news.html').text).include?(text(Nokogiri::HTML5.fragment(item['text']).text)), 'News: missing item')
  end
  site.data['profiles'].each do |profile|
    check(documents.fetch('/contact.html').css('.profile-link').any? { |link| link['href'] == profile['url'] && text(link.text).include?(profile['username']) }, "Profiles: missing #{profile['id']} or username")
  end
end

def validate_missing_content_detection(home, data)
  %w[#featured-paper .featured-title .featured-summary].each do |selector|
    %w[remove empty].each do |mutation|
      document = Nokogiri::HTML5.parse(home)
      node = document.at_css(selector)
      mutation == 'remove' ? node.remove : node.content = '   '
      begin
        validate_home(document, data)
      rescue RuntimeError => error
        check(error.message.include?(selector), "Unexpected content check failure: #{error.message}")
      else
        raise "Missing homepage content was not detected: #{selector} (#{mutation})"
      end
    end
  end
  document = Nokogiri::HTML5.parse(home)
  document.at_css('#featured-paper a.button')['href'] = ''
  begin
    validate_home(document, data)
  rescue RuntimeError => error
    check(error.message.include?('missing paper URL'), "Unexpected empty-link failure: #{error.message}")
  else
    raise 'Empty featured paper URL was not detected'
  end
end

# Test asset coverage with disposable fixtures, independent of real font/image filenames.
def validate_missing_asset_detection(fixture)
  assets = File.join(fixture, 'assets')
  FileUtils.mkdir_p(assets)
  File.write(File.join(fixture, 'index.html'), '<link href="/assets/style.css"><img srcset="/assets/small.webp 1x, /assets/large.webp 2x">')
  File.write(File.join(assets, 'style.css'), "@font-face { src: url('font.woff2'); }")
  %w[small.webp large.webp font.woff2].each { |name| File.binwrite(File.join(assets, name), 'fixture') }
  validate_output(fixture)
  %w[small.webp large.webp font.woff2].each do |name|
    path = File.join(assets, name)
    begin
      File.delete(path)
      begin
        validate_output(fixture)
      rescue RuntimeError => error
        check(error.message.include?(name), "Unexpected asset check failure: #{error.message}")
      else
        raise "Missing asset was not detected: #{name}"
      end
    ensure
      File.binwrite(path, 'fixture')
    end
  end
end

def render_fixture(config, data = {})
  site = Jekyll::Site.new(config)
  site.reset
  site.read
  data.each { |key, value| site.data[key] = value }
  yield site if block_given?
  site.generate
  site.render
  site
end

def validate_rendering(config)
  students = [
    { 'name' => 'Current Later', 'start_date' => '2026-01-01', 'end_date' => '', 'topics' => ['Planning & learning', 'Skills'], 'thesis_title' => 'A & B', 'thesis_link' => 'https://example.com/thesis' },
    { 'name' => 'Former Later', 'start_date' => '2020-01-01', 'end_date' => '2025-01-01', 'thesis_title' => 'Final title' },
    { 'name' => 'Current Earlier', 'start_date' => '2025-01-01' },
    { 'name' => 'Former Earlier', 'start_date' => '2021-01-01', 'end_date' => '2024-01-01' }
  ]
  availability = { 'accepting_students' => true, 'open_message' => 'Open for applications', 'closed_message' => 'Not accepting applications', 'opportunities' => [{ 'title' => 'Advertised project', 'url' => 'https://example.com/project' }] }
  site = render_fixture(config, 'phd_students' => { 'students' => students }, 'doctoral_supervision' => availability) do |fixture|
    fixture.pages.find { |page| page.name == 'contact.html' }.data['description'] = 'Research on "skills" & learning'
  end
  html = site.pages.find { |page| page.name == 'phds.html' }.output
  order = %w[Current\ Earlier Current\ Later Former\ Earlier Former\ Later].map { |name| html.index(name) }
  check(order.none?(&:nil?) && order == order.sort, 'Student ordering regression')
  check(html.include?('Planning &amp; learning') && html.include?('href="https://example.com/thesis"'), 'Topic/thesis rendering regression')
  check(html.scan('(Provisional)').size == 1, 'Provisional label regression')
  check(html.include?('Open for applications') && html.include?('Advertised project') && !html.include?('Not accepting applications'), 'Availability rendering regression')
  contact = site.pages.find { |page| page.name == 'contact.html' }.output
  check(contact.include?('content="Research on &quot;skills&quot; &amp; learning"'), 'Metadata escaping regression')
  fixture = render_fixture(config) do |fixture_site|
    preprint = fixture_site.data['papers'].values.first.dup
    preprint['type'] = 'preprint'
    preprint['preprint'] = 'https://example.com/preprint.pdf'
    preprint.delete('paper')
    fixture_site.data['papers']['check_preprint'] = preprint
    fixture_site.data['profiles'].reject! { |profile| profile['id'] == 'university' }
    twitter = fixture_site.data['profiles'].find { |profile| profile['id'] == 'twitter' }
    if twitter
      twitter['username'] = '@ExampleHandle'
      twitter['url'] = 'https://x.com/ExampleHandle?lang=en'
    end
    fixture_site.data['quotes'][0]['text'] = "First **line**\nSecond line"
    fixture_site.data['quotes'][0]['author'] = '</script> & Author'
  end
  home = fixture.pages.find { |page| page.name == 'index.html' }.output
  publications = fixture.pages.find { |page| page.name == 'publications.html' }.output
  check(publications.match?(%r{href="https://example.com/preprint.pdf"[^>]*>Preprint}), 'Preprint primary link regression')
  check(!home.match?(/href=""/), 'Missing optional university profile created an empty link')
  if fixture.data['profiles'].any? { |profile| profile['id'] == 'twitter' }
    check(home.include?('name="twitter:site" content="@ExampleHandle"'), 'Twitter metadata must use the profile username')
  end
  initial = home[/<blockquote class="quote-text" id="quote-text">(.*?)<\/blockquote>/m, 1].strip
  payload = JSON.parse(home[/<script type="application\/json" id="quotes-data">(.*?)<\/script>/m, 1])
  check(initial == payload.first['html'].strip, 'Initial and rotated quote formatting differ')
  check(initial.include?('<strong>line</strong>') && initial.include?('<br'), 'Quote emphasis/line breaks lost')
  check(payload.first['author'] == '</script> & Author', 'Quote JSON escaping regression')
end

options = {}
OptionParser.new do |parser|
  parser.banner = 'Usage: bundle exec ruby scripts/check.rb [--build] [--preview http://localhost:4000]'
  parser.on('--build', 'Write the checked production build to _site') { options[:build] = true }
  parser.on('--preview URL', 'Also verify content served by a running local preview') { |url| options[:preview] = url }
end.parse!
check(ARGV.empty?, "Unexpected arguments: #{ARGV.join(' ')}")

Dir.chdir(ROOT) do
  validate_data
  Dir['assets/js/*.js', '_includes/*.js', 'scripts/*.cjs'].each { |path| check(system('node', '--check', path), "JavaScript syntax error in #{path} (Node.js is required)") }
  ENV['JEKYLL_ENV'] = 'production'
  Dir.mktmpdir('website-check-') do |temp|
    destination = options[:build] ? File.join(ROOT, '_site') : File.join(temp, 'site')
    config = Jekyll.configuration('config' => ['_config.yaml', '_config_prod.yaml'], 'destination' => destination, 'cache_dir' => File.join(temp, 'cache'), 'disable_disk_cache' => true, 'quiet' => true)
    site = Jekyll::Site.new(config)
    site.process
    validate_output(destination)
    documents = site.pages.select { |page| %w[page default].include?(page.data['layout']) && page.url.match?(%r{(?:/|\.html)\z}) }.to_h do |page|
      [page.url, Nokogiri::HTML5.parse(File.read(page.destination(destination)))]
    end
    validate_content(site, documents)
    validate_missing_content_detection(File.read(File.join(destination, 'index.html')), site.data)
    site.static_files.each do |file|
      check(Digest::SHA256.file(file.path) == Digest::SHA256.file(file.destination(destination)), "Static asset differs from source: #{file.relative_path}")
    end
    %w[_site_dev _drafts scripts docs README.md build.ps1 check.ps1 serve.ps1 Gemfile Gemfile.lock].each do |name|
      check(!File.exist?(File.join(destination, name)), "Production output contains development file: #{name}")
    end
    validate_missing_asset_detection(File.join(temp, 'asset-fixture'))
    validate_rendering(config)
    ENV['JEKYLL_ENV'] = 'development'
    development = render_fixture(Jekyll.configuration('config' => ['_config.yaml', '_config_dev.yaml'], 'cache_dir' => File.join(temp, 'cache'), 'disable_disk_cache' => true, 'quiet' => true))
    check(!development.pages.find { |page| page.name == 'index.html' }.output.include?('googletagmanager.com/gtag/js'), 'Development analytics must be disabled')
    if options[:preview]
      base = URI(options[:preview])
      check(%w[http https].include?(base.scheme) && %w[localhost 127.0.0.1 ::1].include?(base.host), 'Preview must be a local HTTP(S) server')
      preview = Net::HTTP.start(base.hostname, base.port, nil, use_ssl: base.scheme == 'https', open_timeout: 5, read_timeout: 5) do |http|
        documents.keys.to_h do |url|
          response = http.get(url)
          check(response.is_a?(Net::HTTPSuccess), "Preview #{url}: HTTP #{response.code}")
          [url, Nokogiri::HTML5.parse(response.body)]
        end
      end
      validate_content(development, preview)
      # Compare manually edited homepage copy too, without pinning its wording in tests.
      expected = Nokogiri::HTML5.parse(development.pages.find { |page| page.name == 'index.html' }.output)
      %w[.featured-title .featured-summary].each do |selector|
        check(text(preview.fetch('/').at_css(selector).text) == text(expected.at_css(selector).text), "Preview: stale #{selector}; restart Jekyll after config changes")
      end
      check(preview.fetch('/').at_css('#featured-paper a.button')['href'] == expected.at_css('#featured-paper a.button')['href'], 'Preview: stale featured paper link')
      check(preview.values.none? { |document| document.css('script[src]').any? { |script| script['src'].include?('googletagmanager.com/gtag/js') } }, 'Preview must not load production analytics')
      puts "Passed: live preview content at #{base}"
    end
    ENV['JEKYLL_ENV'] = 'production'
    if site.config['analytics_id']
      check(File.read(File.join(destination, 'index.html')).include?('googletagmanager.com/gtag/js'), 'Production analytics missing')
    end
  end
  puts 'Passed: data schemas, YAML keys, BibTeX, JavaScript syntax, production HTML, rendered content, static assets, local links, JSON, and regression fixtures.'
  puts 'Checked production output: _site' if options[:build]
end
