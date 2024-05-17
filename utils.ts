import { Token, Tokens, Marked, options, Lexer} from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import GetCallout from "callouts";


export interface ParseOptions {
    lineNumber: boolean;
	linkStyle: 'footnote' | 'inline';
};

let AllLinks:string[] = [];
const parseOptions:ParseOptions = {
    lineNumber: true,
	linkStyle: 'footnote'
};
const markedOptiones = {
    gfm: true,
    breaks: true,
};

function code(code: string, infostring: string | undefined): string {
    const lang = (infostring || '').match(/^\S*/)?.[0];
    code = code.replace(/\n$/, '') + '\n';

	let codeSection = '';
	if (parseOptions.lineNumber) {
		const lines = code.split('\n');
		
		let liItems = '';
		let count = 1;
		while (count < lines.length) {
			liItems = liItems + `<li>${count}</li>`;
			count = count + 1;
		}
    	codeSection='<section class="code-section"><ul>'
        	+ liItems
        	+ '</ul>';
	}
	else {
    	codeSection='<section class="code-section">';
	}
        
    if (!lang) {
      return codeSection + '<pre><code>'
        + code
        + '</code></pre></section>\n';
    }

    return codeSection+'<pre><code class="hljs language-'
      + lang
      + '">'
      + code
      + '</code></pre></section>\n';
}

function codeRender(codeToken:Tokens.Code) {
	const result = code(codeToken.text, codeToken.lang);
	return result;
}

function matchCallouts(text:string) {
    const regex = /\[\!(.*?)\]/g;
	let m;
	if( m = regex.exec(text)) {
	    return m[1];
	}
	return "";
}

function calloutRender(token: Tokens.Blockquote) {
	let callout = matchCallouts(token.text);
	if (callout == '') {
		const body = this.parser.parse(token.tokens);
        return `<blockquote>\n${body}</blockquote>\n`;;
	}

	const info = GetCallout(callout);

	const lexer = new Lexer(markedOptiones);
	token.text = token.text.replace(`[!${callout}]\n`, '');
	token.tokens = lexer.lex(token.text);
	
	const body = this.parser.parse(token.tokens);
	callout = callout.charAt(0).toUpperCase() + callout.slice(1)
	return `
		<section class="note-callout ${info?.style}">
			<section class="note-callout-title-wrap">
				${info?.icon}
				<span class="note-callout-title">${callout}<span>
			</section>
			<section class="note-callout-content">
				${body}
			</section>
		</section>`;
}

function walkTokens(token:Token) {
	if (token.type == 'link') {
		const link = token as Tokens.Link;
		if (token.text.indexOf(token.href) === -1 && !(token.href.indexOf('https://mp.weixin.qq.com/s/') === 0)) {
			AllLinks.push(link.href);
			if (parseOptions.linkStyle == 'footnote') {
				const txtToken:Tokens.Text = {type: 'text', raw: link.text, text: link.text};
				token.tokens = [txtToken, ... this.Lexer.lexInline(`<sup>[${AllLinks.length}]</sup>`)];
			}
			else {
				for (const t of link.tokens) {
					if (t.type == 'text') {
						t.text = link.text + '[' + link.href + ']';
					}
				}
			}
		}
	}
}

function footnoteLinks() {
	const links = AllLinks.map((href, i) => {
		return `<li>${href}&nbsp;↩</li>`;
	});
	return `<seciton class="footnotes"><hr><ol>${links.join('\n')}</ol></section>`;
}

export async function markedParse(content:string, op:ParseOptions)  {
	parseOptions.lineNumber = op.lineNumber;
	parseOptions.linkStyle = op.linkStyle;

	const m = new Marked(
	    markedHighlight({
	    langPrefix: 'hljs language-',
	    highlight(code, lang, info) {
		  if (lang && hljs.getLanguage(lang)) {
		      try {
		          const result = hljs.highlight(lang, code);
				  return result.value;
		      } catch (err) {}
		  }
		  
		  try {
		      const result = hljs.highlightAuto(code);
		      return result.value;
		  } catch (err) {}
		  
		  return ''; // use external default escaping
	    }
	  })
	);
	AllLinks = [];
	m.use(markedOptiones);
	m.use({walkTokens});
	m.use({
		extensions: [{
		    name: 'code',
			level: 'block',
			renderer(token) {
				return codeRender.call(this, token);
			},
		},
		{
			name: 'blockquote',
			level: 'block',
			renderer(token) {
				return calloutRender.call(this, token as Tokens.Blockquote);
			}, 
		}],
	});
	const html = await m.parse(content);
	if (parseOptions.linkStyle == 'footnote') {
	    return html + footnoteLinks();
	}
	return html;
}