import { describe, expect, it } from 'vitest';

import { detectRobot } from '../../../src/utils/index';

/**
 * `detectRobot` wraps the `isbot` package (issue #567) — previously a
 * hand-rolled 26-pattern regex that pre-dated the AI-crawler boom. These tests
 * cover the AI crawlers named in the issue, the classic crawlers the old regex
 * caught (no regression), and real browser UAs that must never be flagged.
 */
describe( 'detectRobot', () => {
	const aiCrawlers = [
		[ 'GPTBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot' ],
		[ 'ClaudeBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)' ],
		[ 'Bytespider', 'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)' ],
		[ 'PerplexityBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)' ],
	];

	it.each( aiCrawlers )( 'flags AI crawler %s', ( name, ua ) => {
		expect( detectRobot( ua ) ).toBe( true );
	} );

	const classicCrawlers = [
		[ 'Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' ],
		[ 'Bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' ],
		[ 'DuckDuckBot', 'DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)' ],
		[ 'YandexBot', 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)' ],
	];

	it.each( classicCrawlers )( 'still flags classic crawler %s', ( name, ua ) => {
		expect( detectRobot( ua ) ).toBe( true );
	} );

	const browsers = [
		[ 'Chrome on macOS', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36' ],
		[ 'Safari on iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' ],
		[ 'Firefox on Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0' ],
	];

	it.each( browsers )( 'does not flag %s', ( name, ua ) => {
		expect( detectRobot( ua ) ).toBe( false );
	} );

	it( 'does not flag an empty user agent', () => {
		expect( detectRobot( '' ) ).toBe( false );
	} );
} );
