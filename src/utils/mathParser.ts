import katex from 'katex';
import { AiTriggerMode } from '../types';

// Core unambiguous math functions and Greek constants (3+ letters)
const MATH_WORDS = new Set([
  'sin', 'cos', 'tan', 'csc', 'sec', 'cot',
  'arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan', 'atan2',
  'arccsc', 'arcsec', 'arccot',
  'sinh', 'cosh', 'tanh', 'csch', 'sech', 'coth',
  'log', 'exp', 'sqrt', 'cbrt', 'nthroot',
  'abs', 'sgn', 'sign', 'floor', 'ceil', 'round', 'mod',
  'gcd', 'lcm', 'ncr', 'npr',
  'min', 'max', 'sum', 'prod', 'int',
  'tau', 'theta', 'alpha', 'beta', 'gamma', 'delta',
  'epsilon', 'zeta', 'eta', 'iota', 'kappa', 'lambda',
  'omicron', 'rho', 'sigma', 'upsilon', 'phi', 'chi', 'psi', 'omega',
  'infty', 'infinity', 'ans',
]);

// Desmos functions that look like English words unless called with (...)
const CALL_ONLY_MATH_FNS =
  /\b(mean|median|quantile|quartile|stdev|stdevp|var|varp|cov|covp|corr|spearman|total|length|join|sort|shuffle|unique|polygon|distance|midpoint|rgb|hsv|oklch|normaldist|tdist|poissondist|binomialdist|uniformdist|pdf|cdf|inversecdf|random|histogram|dotplot|boxplot|ttest|ztest|stats)\s*\(/gi;

const AI_TRIGGER_WORDS = new Set([
  // English trigger words
  'solve', 'find', 'what', 'whats', 'how', 'why', 'when', 'where', 'which',
  'explain', 'simplify', 'factor', 'factorize', 'expand',
  'integrate', 'differentiate', 'derivative', 'derivatives', 'integral', 'antiderivative',
  'limit', 'prove', 'calculate', 'compute', 'evaluate', 'convert',
  'roots', 'zeros', 'zeroes', 'domain', 'range', 'asymptote', 'asymptotes',
  'taylor', 'maclaurin', 'series', 'converge', 'converges', 'diverge', 'diverges',
  'eigenvalue', 'eigenvalues', 'eigenvector', 'eigenvectors',
  'determinant', 'inverse', 'transpose', 'rref', 'laplace', 'fourier',
  'gradient', 'curl', 'divergence', 'jacobian', 'hessian',
  'tangent', 'inflection', 'critical', 'extrema', 'maximize', 'minimize',
  'area', 'volume', 'surface', 'slope', 'intercept', 'intercepts',
  'vertex', 'focus', 'directrix', 'probability', 'define', 'tell', 'give', 'show',
  // Azerbaijani math question trigger words
  'tapın', 'tapin', 'hesablayın', 'hesablayin', 'tənliyin', 'tenliyin',
  'kökləri', 'kokleri', 'kökünü', 'kokunu', 'qiymətini', 'qiymetini',
  'əgər', 'eger', 'olarsa', 'neçədir', 'necedir', 'hansıdır', 'hansidir',
  'cəmini', 'cemini', 'hasilini', 'sadələşdirin', 'sadelesdirin',
]);

/**
 * Detects SAT / multiple-choice option markers like A), B), C), D) or (A), (B), (C), (D)
 * without false positives on valid math expressions like `f(a)` or `(x + a)`.
 */
function hasMultipleChoiceMarkers(text: string): boolean {
  // Parenthesized (A), (B), (C), (D) not preceded by an identifier/backslash (excludes f(a), \sin(b))
  const parenChoices = text.match(/(?<![\p{L}\p{N}_\\])\([abcdABCD]\)/gu);
  if (parenChoices && parenChoices.length >= 2) {
    return true;
  }
  if (/(?:^|\s)\([abcdABCD]\)\s+\S/u.test(text)) {
    return true;
  }

  // Sequential A) ... B) ... even if pasted without leading space
  if (/(?<![\p{L}\p{N}_\\])[abcdABCD]\)\s*\S[\s\S]*?(?<![\p{L}\p{N}_\\])[bcdBCD]\)/u.test(text)) {
    return true;
  }

  // Unmatched A), B), C), D) at parenthesis depth 0 (never matches `(x + a)` where depth > 0)
  let parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') {
      parenDepth++;
    } else if (ch === ')') {
      if (parenDepth > 0) {
        parenDepth--;
      } else if (i >= 1) {
        const prev = text[i - 1];
        const beforePrev = i >= 2 ? text[i - 2] : '';
        if (
          /[abcdABCD]/.test(prev) &&
          (beforePrev === '' || /[^\p{L}\p{N}_\\]/u.test(beforePrev))
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

export function classifyInput(
  rawInput: string,
  triggerMode: AiTriggerMode,
  prefixChar = '?'
): { isAi: boolean; prompt: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { isAi: false, prompt: '' };
  }

  const effectivePrefix = prefixChar || '?';
  if (trimmed.startsWith(effectivePrefix)) {
    const prompt = trimmed.slice(effectivePrefix.length).trim();
    return { isAi: true, prompt };
  }

  // 1. Contains '?' anywhere in the text
  if (trimmed.includes('?') && trimmed.replace(/\?/g, '').trim().length > 0) {
    return { isAi: true, prompt: trimmed };
  }

  // 2. Contains multiple-choice markers A), B), C), D) or (A), (B), (C), (D)
  if (hasMultipleChoiceMarkers(trimmed)) {
    return { isAi: true, prompt: trimmed };
  }

  // 3. Contains more than one '=' sign (ignoring <=, >=, !=)
  const withoutInequalities = trimmed.replace(/<=|>=|!=/g, ' ');
  const equalsCount = (withoutInequalities.match(/=/g) || []).length;
  if (equalsCount > 1) {
    return { isAi: true, prompt: trimmed };
  }

  // 4. Length exceeds 60 characters and contains spaces
  if (trimmed.length > 60 && /\s/.test(trimmed)) {
    return { isAi: true, prompt: trimmed };
  }

  // Strip LaTeX commands (\sin, \frac, \operatorname{...}, etc.) and explicit Desmos fn(...) calls
  const withoutLatex = trimmed
    .replace(/\\operatorname\{[^}]*\}/g, ' ')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(CALL_ONLY_MATH_FNS, '(');

  // 5. 2+ English/Azerbaijani natural words (3+ Unicode letters not in standard math functions)
  const words3Plus = withoutLatex.match(/\p{L}{3,}/gu) || [];
  const nonMathWords3Plus = words3Plus.filter(
    (w) => !MATH_WORDS.has(w.toLowerCase())
  );
  if (nonMathWords3Plus.length >= 2) {
    return { isAi: true, prompt: trimmed };
  }

  if (triggerMode === 'prefix') {
    return { isAi: false, prompt: '' };
  }

  // Additional single-word auto-detect helpers (e.g. "solve 2x + 5 = 11", "factor x^2 - 4")
  if (words3Plus.length === 0) {
    return { isAi: false, prompt: '' };
  }

  const isSimpleVarAssign = /^[\p{L}][\p{L}\p{N}_]*\s*=\s*[^=]/u.test(withoutLatex);

  if (!isSimpleVarAssign) {
    for (const word of words3Plus) {
      if (AI_TRIGGER_WORDS.has(word.toLowerCase()) && /\s/.test(trimmed)) {
        return { isAi: true, prompt: trimmed };
      }
    }
  }

  if (
    nonMathWords3Plus.length === 1 &&
    !isSimpleVarAssign &&
    nonMathWords3Plus[0].length >= 4 &&
    /\s/.test(trimmed) &&
    !new RegExp(`${nonMathWords3Plus[0]}\\s*\\(`, 'u').test(withoutLatex)
  ) {
    return { isAi: true, prompt: trimmed };
  }

  return { isAi: false, prompt: '' };
}

/**
 * Replace balanced function call like sqrt(...) with \sqrt{...}
 */
function replaceBalancedCall(
  input: string,
  fnName: string,
  wrapLeft: string,
  wrapRight: string
): string {
  const pattern = new RegExp(`(?<!\\\\)\\b${fnName}\\s*\\(`, 'g');
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    const startCall = match.index;
    const openParenIdx = match.index + match[0].length - 1;
    let depth = 1;
    let i = openParenIdx + 1;
    while (i < input.length && depth > 0) {
      if (input[i] === '(') depth++;
      else if (input[i] === ')') depth--;
      i++;
    }
    if (depth === 0) {
      const inner = input.slice(openParenIdx + 1, i - 1);
      result +=
        input.slice(lastIndex, startCall) +
        wrapLeft +
        replaceBalancedCall(inner, fnName, wrapLeft, wrapRight) +
        wrapRight;
      lastIndex = i;
      pattern.lastIndex = i;
    } else {
      break;
    }
  }

  result += input.slice(lastIndex);
  return result;
}

/**
 * Converts friendly typed math (e.g. `sin(x)`, `145 * 18`, `y = x^2`, `sqrt(x+1)`)
 * into valid Desmos & KaTeX LaTeX while leaving existing LaTeX (`y = \sin(x)`) intact.
 */
export function toDesmosLatex(raw: string): string {
  let s = raw.trim();
  if (!s) return '';

  // Balanced sqrt(...) -> \sqrt{...} and abs(...) -> \left|...\right|
  s = replaceBalancedCall(s, 'sqrt', '\\sqrt{', '}');
  s = replaceBalancedCall(s, 'abs', '\\left|', '\\right|');

  // Comparison operators
  s = s.replace(/<=/g, '\\le ');
  s = s.replace(/>=/g, '\\ge ');
  s = s.replace(/!=/g, '\\ne ');

  // Multiplication asterisk -> \cdot
  s = s.replace(/\*/g, ' \\cdot ');

  // Exponents: x^(2x+1) -> x^{2x+1}, x^-2 -> x^{-2}, x^12 -> x^{12}
  s = s.replace(/\^\(([^()]+)\)/g, '^{$1}');
  s = s.replace(/\^(-?[a-zA-Z0-9.]+)/g, '^{$1}');

  // Greek & infinity constants when not already prefixed by \
  s = s.replace(/(?<!\\)\b(pi|theta|tau|alpha|beta|gamma|delta|phi|omega)\b/g, '\\$1');
  s = s.replace(/(?<!\\)\b(infinity|infty)\b/g, '\\infty');

  // Standard LaTeX functions when not already prefixed by \
  s = s.replace(
    /(?<!\\)\b(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|csc|sec|cot|ln|log|min|max|gcd)\b/g,
    '\\$1'
  );

  // Desmos statistical & multi-letter functions requiring \operatorname{...}
  s = s.replace(
    /(?<!\\)(?<!\\operatorname\{)\b(normaldist|tdist|binomialdist|poissondist|uniformdist|ttest|ztest|mean|median|stdev|stdevp|var|total|length|lcm|mod|nCr|nPr|floor|ceil|round)\b/g,
    '\\operatorname{$1}'
  );

  return s;
}

/**
 * Renders a math expression cleanly to HTML using KaTeX for unfocused math rows.
 */
export function renderMathToHtml(raw: string): string {
  const latex = toDesmosLatex(raw);
  if (!latex) return '';
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
      strict: false,
    });
  } catch {
    return '';
  }
}

/**
 * Formats numbers cleanly in Desmos style (avoiding floating point noise like 0.30000000000000004).
 */
export function formatDesmosNumber(val: number): string {
  if (!Number.isFinite(val)) {
    if (val === Infinity) return '∞';
    if (val === -Infinity) return '-∞';
    return '';
  }
  if (Object.is(val, -0) || Math.abs(val) < 1e-15) return '0';
  if (Math.abs(val) >= 1e12 || (Math.abs(val) < 1e-5 && val !== 0)) {
    const exp = val.toExponential(6).replace(/\.?0+e/, 'e');
    const [mantissa, power] = exp.split('e');
    return `${mantissa} × 10^${power.replace('+', '')}`;
  }
  return Number(val.toPrecision(11)).toString();
}

/**
 * Renders inline math segments ($...$, \(...\), \[...\]) inside stealth AI responses via KaTeX,
 * while keeping plain text crisp and free of markdown artifacts.
 */
export function renderStealthLineHtml(line: string): string {
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  // Match $$...$$, \[...\], $...$, \(...\)
  const tokenRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+\$|\\\([\s\S]+?\\\))/g;
  const parts = line.split(tokenRegex);

  if (parts.length === 1) {
    // Check if the entire line looks like LaTeX (contains \boxed, \frac, \sqrt, ^{, etc.)
    if (
      /\\(boxed|frac|sqrt|pm|cdot|times|int|sum|pi|infty|le|ge|ne|sin|cos|tan|ln|log)/.test(
        line
      )
    ) {
      try {
        return katex.renderToString(line, { throwOnError: false, displayMode: false });
      } catch {
        return escapeHtml(line);
      }
    }
    return escapeHtml(line);
  }

  return parts
    .map((part) => {
      if (!part) return '';
      let mathInner: string | null = null;
      if (part.startsWith('$$') && part.endsWith('$$')) {
        mathInner = part.slice(2, -2);
      } else if (part.startsWith('\\[') && part.endsWith('\\]')) {
        mathInner = part.slice(2, -2);
      } else if (part.startsWith('$') && part.endsWith('$')) {
        mathInner = part.slice(1, -1);
      } else if (part.startsWith('\\(') && part.endsWith('\\)')) {
        mathInner = part.slice(2, -2);
      }
      if (mathInner !== null) {
        try {
          return katex.renderToString(mathInner.trim(), {
            throwOnError: false,
            displayMode: false,
          });
        } catch {
          return escapeHtml(mathInner);
        }
      }
      return escapeHtml(part);
    })
    .join('');
}

/**
 * Renders multi-paragraph step-by-step AI explanations with KaTeX inline/display math,
 * clean bold headings, and safe HTML escaping for the dedicated AI Chat View.
 */
export function renderRichAiMessageHtml(raw: string): string {
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const formatTextSegment = (segment: string) => {
    const escaped = escapeHtml(segment);
    return escaped
      .replace(/^#{1,4}\s+(.+)$/gm, '<strong class="font-semibold text-[#1f1f1f]">$1</strong>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong class="font-semibold text-[#1f1f1f]">$1</strong>')
      .replace(/`([^`\n]+)`/g, '<code class="rounded bg-black/5 px-1 py-0.5 font-mono text-[11px]">$1</code>');
  };

  const tokenRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+\$|\\\([\s\S]+?\\\))/g;
  const parts = raw.split(tokenRegex);

  return parts
    .map((part) => {
      if (!part) return '';
      if (
        (part.startsWith('$$') && part.endsWith('$$')) ||
        (part.startsWith('\\[') && part.endsWith('\\]'))
      ) {
        const inner = part.slice(2, -2).trim();
        try {
          const rendered = katex.renderToString(inner, {
            throwOnError: false,
            displayMode: true,
          });
          return `<div class="my-1 overflow-x-auto no-scrollbar py-0.5">${rendered}</div>`;
        } catch {
          return formatTextSegment(inner);
        }
      }
      if (
        (part.startsWith('$') && part.endsWith('$')) ||
        (part.startsWith('\\(') && part.endsWith('\\)'))
      ) {
        const inner = part.startsWith('$') ? part.slice(1, -1) : part.slice(2, -2);
        try {
          return katex.renderToString(inner.trim(), {
            throwOnError: false,
            displayMode: false,
          });
        } catch {
          return formatTextSegment(inner);
        }
      }
      return formatTextSegment(part);
    })
    .join('');
}
