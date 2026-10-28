"""Conservative text/math labels shared by reference creation and refresh.

Do not guess incompatible MathLive/MathJax text-mode escaping. Callers can offer
number or selected-expression mode when a title contains unsupported text.
"""
import re
ERROR='This title needs special text formatting. Choose Number or Keep selected expression.'

def math_label(label):
    if not isinstance(label,str) or not label or len(label)>4000:raise ValueError('Invalid or oversized math reference label')
    out=[];plain=[];i=0
    def flush():
        if not plain:return
        text=''.join(plain)
        if re.search(r'[\\{}%#&~^_$\r\n]',text):raise ValueError(ERROR)
        out.append(r'\text{'+text+'}');plain.clear()
    while i<len(label):
        opener=next((x for x in ('$$',r'\(',r'\[','$') if label.startswith(x,i)),None)
        if not opener:plain.append(label[i]);i+=1;continue
        flush();closer={r'\(':r'\)',r'\[':r'\]'}.get(opener,opener);end=i+len(opener)
        while end<len(label):
            if label.startswith(closer,end) and label[end-1]!='\\':break
            end+=1
        if end==len(label):raise ValueError(ERROR)
        body=label[i+len(opener):end]
        if not body.strip() or '$' in body or '%' in body or '\n' in body or '\r' in body:raise ValueError(ERROR)
        # The wrapper validator checks balanced groups and nested references.
        from reference_format import math_reference
        math_reference(body,'c','validation')
        out.append(body);i=end+len(closer)
    flush();return ''.join(out)
