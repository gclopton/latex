"""Retrieval normalization only: no algebra, equivalence or identity merging."""
import re

def literal(text):
    return re.sub(r'\s+', '', text.strip().strip('$'))

def tokens(text):
    greek='alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega'.split()
    unicode=dict(zip('αβγδεζηθικλμνξοπρστυφχψω',greek));unicode.update({'∂':'partial','∇':'nabla','∫':'int','≤':'leq','≥':'geq','·':'cdot','×':'times','√':'sqrt','∞':'infty'})
    supers=str.maketrans('⁰¹²³⁴⁵⁶⁷⁸⁹','0123456789')
    text=re.sub('[⁰¹²³⁴⁵⁶⁷⁸⁹]+',lambda m:'^'+m[0].translate(supers),text)
    text=re.sub(r'(?<![A-Za-z\\])(?:sin|cos|tan|sec|csc|cot|log|ln|exp|lim|max|min|det)(?![A-Za-z])',lambda m:'\\'+m[0],text)
    text=''.join('\\'+unicode[c]+' ' if c in unicode else c for c in text)
    text=re.sub(r'\\(?:left|right|displaystyle)\b','',text)
    text=re.sub(r'\\(?:dfrac|tfrac)\b',r'\\frac',text)
    text=re.sub(r"\^\s*\{?\s*\\prime\s*\}?", "'", text)
    text=re.sub(r'\\(?:,|;|!|quad\b|qquad\b|enspace\b)', '',text)
    symbols={'+':'plus','-':'minus','=':'equals','/':'over',"'":'prime','(':'open',')':'close','<':'less','>':'greater','*':'times','^':'sup','_':'sub','|':'abs'}
    return ' '.join(symbols.get(t,t.removeprefix('\\')) for t in re.findall(r'\\[A-Za-z]+|[A-Za-z]|\d+|[+\-=/\x27()<>*^_|]',text))

def fragments(body):
    return re.findall(r'\$\$(.*?)\$\$|(?<!\\)\$([^$\n]+)\$|\\\[(.*?)\\\]|\\\((.*?)\\\)',body,re.S)

def projection(body):
    return '\n'.join(tokens(next((x for x in row if x),'')) for row in fragments(body))

def expression(query):
    value=tokens(query.strip().strip('$'))
    return '"'+value+'"' if value else None
