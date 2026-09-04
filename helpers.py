import re

# ---------------------------------------------------------------- LaTeX accents
_ACCENTS = {
    ("'", 'a'):'á', ("'", 'e'):'é', ("'", 'i'):'í', ("'", 'o'):'ó', ("'", 'u'):'ú',
    ("'", 'c'):'ć', ("'", 'n'):'ń', ("'", 's'):'ś', ("'", 'y'):'ý', ("'", 'z'):'ź',
    ('`', 'a'):'à', ('`', 'e'):'è', ('`', 'i'):'ì', ('`', 'o'):'ò', ('`', 'u'):'ù',
    ('"', 'a'):'ä', ('"', 'e'):'ë', ('"', 'i'):'ï', ('"', 'o'):'ö', ('"', 'u'):'ü',
    ('"', 'y'):'ÿ',
    ('^', 'a'):'â', ('^', 'e'):'ê', ('^', 'i'):'î', ('^', 'o'):'ô', ('^', 'u'):'û',
    ('~', 'a'):'ã', ('~', 'n'):'ñ', ('~', 'o'):'õ',
    ('c', 'c'):'ç', ('c', 's'):'ş',
    ('v', 'c'):'č', ('v', 's'):'š', ('v', 'z'):'ž', ('v', 'r'):'ř', ('v', 'e'):'ě',
    ('u', 'a'):'ă', ('u', 'g'):'ğ',
    ('=', 'a'):'ā', ('=', 'e'):'ē', ('=', 'o'):'ō', ('=', 'u'):'ū',
    ('.', 'z'):'ż', ('.', 'e'):'ė',
    ('H', 'o'):'ő', ('H', 'u'):'ű',
    ('k', 'a'):'ą', ('k', 'e'):'ę',
}

def delatex(s):
    """Turn BibTeX/LaTeX name markup into plain readable text."""
    if not s:
        return ''
    # dotless i / j used under accents: \'{\i} -> i
    s = re.sub(r'\\i\b', 'i', s)
    s = re.sub(r'\\j\b', 'j', s)
    # \"{u}  \'{e}  \c{c}  \v{s}   (accent then braced letter)
    def acc_braced(m):
        return _ACCENTS.get((m.group(1), m.group(2)), m.group(2))
    s = re.sub(r'\\([\'`"^~=.cvuHk])\{(\w)\}', acc_braced, s)
    # {\"u}  {\'e}   (braces around accent + letter)
    s = re.sub(r'\{\\([\'`"^~=.cvuHk])\s*(\w)\}', acc_braced, s)
    # \"u  \'e   (accent directly before letter)
    s = re.sub(r'\\([\'`"^~=.])\s*(\w)', acc_braced, s)
    # special glyphs
    for a, b in [(r'\\ss', 'ß'), (r'\\o\b', 'ø'), (r'\\O\b', 'Ø'), (r'\\aa', 'å'),
                 (r'\\AA', 'Å'), (r'\\ae', 'æ'), (r'\\AE', 'Æ'), (r'\\l\b', 'ł'),
                 (r'\\&', '&'), (r'\\%', '%'), (r'\\_', '_'), (r'\\#', '#')]:
        s = re.sub(a, b, s)
    s = s.replace('\\', '')
    s = s.replace('{', '').replace('}', '')
    s = re.sub(r'\s+', ' ', s).strip()
    return s

# ---------------------------------------------------------------- author field
def _field(bib, name):
    """Pull a brace-balanced BibTeX field value."""
    if not bib:
        return ''
    m = re.search(r'\b' + name + r'\s*=\s*[{"]', bib, re.I)
    if not m:
        return ''
    i = m.end() - 1
    opener = bib[i]
    if opener == '"':
        j = bib.find('"', i + 1)
        return bib[i + 1:j] if j > 0 else ''
    depth, j = 0, i
    while j < len(bib):
        if bib[j] == '{':
            depth += 1
        elif bib[j] == '}':
            depth -= 1
            if depth == 0:
                return bib[i + 1:j]
        j += 1
    return ''

_NOISE = re.compile(r'^(others|et\.? al\.?)$', re.I)

def parse_authors(bib):
    """Return a list of {full, last} dicts from a BibTeX entry."""
    raw = _field(bib, 'author')
    if not raw:
        return []
    raw = re.sub(r'\s+', ' ', raw)
    parts = re.split(r'\s+and\s+', raw)
    out = []
    for p in parts:
        p = p.strip().strip(',').strip()
        if not p or _NOISE.match(p):
            continue
        p = delatex(p)
        if not p:
            continue
        if ',' in p:
            last = p.split(',')[0].strip()
            first = p.split(',', 1)[1].strip()
            full = (first + ' ' + last).strip()
        else:
            toks = p.split()
            # keep nobiliary particles with the surname (van der Meer -> van der Meer)
            k = len(toks) - 1
            while k > 1 and toks[k - 1].islower():
                k -= 1
            last = ' '.join(toks[k:])
            full = p
        last = last.strip(' .,')
        if last:
            out.append({'full': full, 'last': last})
    return out

def author_line(authors, limit=3):
    """First `limit` surnames, then 'et al.'"""
    if not authors:
        return ''
    names = [a['last'] for a in authors]
    if len(names) <= limit:
        return ', '.join(names[:-1]) + ' and ' + names[-1] if len(names) > 1 else names[0]
    return ', '.join(names[:limit]) + ' et al.'

def author_line_full(authors):
    """Every surname, joined naturally: 'A', 'A and B', or 'A, B and C'."""
    if not authors:
        return ''
    names = [a['last'] for a in authors]
    if len(names) == 1:
        return names[0]
    return ', '.join(names[:-1]) + ' and ' + names[-1]

# ---------------------------------------------------------------- eye trackers
# order matters: first match wins for each pattern group
TRACKER_RULES = [
    ('EyeLink (SR Research)', r'eye\s*-?\s*link|eyelink|sr[\s-]*research|sr-eyelink'),
    ('Tobii',                 r'\btobii\b'),
    ('SMI',                   r'\bsmi\b|iview'),
    ('Pupil Labs',            r'\bpupil\b|pupillabs|pupil labs'),
    ('HTC Vive',              r'htc\s*vive|7invensun'),
    ('Oculus',                r'\boculus\b'),
    ('Microsoft HoloLens',    r'hololens'),
    ('FOVE',                  r'\bfove\b'),
    ('Gazepoint',             r'gazepoint'),
    ('Dikablis',              r'dikablis'),
    ('ASL',                   r'asleyetracking|\basl\b'),
    ('Webcam / consumer camera',
     r'webcam|web cam|laptop camera|phone front|iphone|logitech|gopro|canon|kinect|'
     r'realeye|itracker|ordro|zshade|ivue|camera glasses'),
    ('Research / custom rig',
     r'custom|thorlabs|pointgrey|point grey|nir[\s-]*camera|rgb-?d|realsense|'
     r'head\s*-?\s*mounted camera|duo3d|basler|led'),
]

def tracker_brands(hardware):
    s = (hardware or '').lower()
    if not s.strip() or s.strip() in ('-', 'not specified', 'not applicable', 'nan'):
        return ['Not stated']
    hits = [label for label, pat in TRACKER_RULES if re.search(pat, s)]
    # a bare "Vive"/"Oculus" entry that also names a tracker keeps both - that's wanted
    return hits or ['Other / unclear']

# ---------------------------------------------------------------- explicit models
# Ordered most-specific-first; a hardware string can match more than one model
# (rare, e.g. "SMI + HTC Vive"), so every matching pattern is kept.
MODEL_RULES = [
    ('EyeLink 1000 Plus',   r'eye\s*-?\s*link\s*1000\s*(plus|\+)|1000\+?\s*plus'),
    ('EyeLink 2000',        r'eye\s*-?\s*link\s*2000'),
    ('EyeLink 1000',        r'eye\s*-?\s*link[\s-]*1000(?!\s*(plus|\+))'),
    ('EyeLink II',          r'eye\s*-?\s*link\s*ii\b'),
    ('EyeLink Portable Duo', r'eye\s*-?\s*link\s*portable\s*duo'),
    ('Tobii TX300',         r'tobii\s*tx\s*300'),
    ('Tobii T60 XL',        r'tobii\s*t\s*60\s*xl'),
    ('Tobii T60',           r'tobii\s*t\s*60(?!\s*xl)'),
    ('Tobii T120',          r'tobii\s*t\s*120'),
    ('Tobii X2-60',         r'tobii\s*x\s*2[\s-]*60'),
    ('Tobii X3-120',        r'tobii\s*(pro\s*)?x\s*3[\s-]*120'),
    ('Tobii X120',          r'tobii\s*x\s*120'),
    ('Tobii 4C',            r'tobii\s*4c'),
    ('Tobii Glasses 2',     r'tobii\s*(pro\s*)?glasses\s*2'),
    ('Tobii Spectrum',      r'tobii\s*(pro\s*)?spectrum'),
    ('Tobii 1750',          r'tobii\s*1750'),
    ('HTC Vive Pro Eye',    r'htc\s*vive\s*pro\s*eye'),
    ('HTC Vive',            r'htc\s*vive(?!\s*pro\s*eye)'),
    ('Pupil Invisible',     r'pupil\s*(labs\s*)?invisible'),
    ('Pupil Core',          r'pupil\s*(labs\s*)?core|pupillabs\s*core'),
    ('SMI RED250',          r'smi\s*[:\s]*red\s*250'),
    ('SMI ETG 2W',          r'smi\s*etg\s*2w?'),
    ('SMI HiSpeed 1250',    r'smi\s*hi\s*speed\s*1250'),
    ('Gazepoint GP3',       r'gazepoint\s*gp3'),
    ('Dikablis Pro',        r'dikablis\s*pro'),
    ('Microsoft HoloLens 2', r'hololens\s*2'),
    ('FOVE',                r'\bfove\b'),
]

def tracker_models(hardware):
    """Explicit, named tracker/headset models mentioned in a hardware string.
    Deliberately narrower than tracker_brands: generic mentions ("webcam",
    "Pupil", "Tobii eye tracker not specified") are excluded since they name
    no specific model."""
    s = (hardware or '').lower()
    if not s.strip():
        return []
    return [label for label, pat in MODEL_RULES if re.search(pat, s)]

