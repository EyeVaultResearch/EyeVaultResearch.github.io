import pandas as pd, json, re, unicodedata
from helpers import parse_authors, author_line, author_line_full, tracker_brands, tracker_models

SRC = '/mnt/user-data/uploads/Lynsay_Eye_Tracking_Datasets.csv'
df = pd.read_csv(SRC, dtype=str).fillna('')

def clean(v):
    """Tidy a raw cell for display: fix literal \\n, collapse whitespace."""
    if v is None: return ''
    s = str(v)
    s = s.replace('\\n', ' ').replace('\r', ' ')
    s = unicodedata.normalize('NFC', s)
    s = re.sub(r'[ \t\n]+', ' ', s).strip()
    return s

# values that mean "the paper did not tell us"
BLANK = {'', '-', '--', 'n/a', 'na', 'nan', 'none', 'not specified', 'not specifed',
         'not mentioned', 'not reported', 'not clear', 'unspecified', 'not applicable',
         'not aplicable', 'no', 'not stated', 'not given', 'various (not stated in paper)'}

def is_reported(v):
    return clean(v).lower().strip('. ') not in BLANK

def norm(v):
    return clean(v).lower()

# ---------------------------------------------------------------- facets
def f_modality(v):
    s = norm(v)
    if not s or s in BLANK: return ['Not stated']
    out = []
    if 'vr' in re.findall(r'[a-z]+', s) or 'virtual' in s or 'hmd' in s: out.append('VR / AR headset')
    if re.search(r'wear|glass|head-?mount|hmd', s) and 'VR / AR headset' not in out: out.append('Wearable / head-mounted')
    elif re.search(r'wear|glass|head-?mount', s) and 'Wearable / head-mounted' not in out and 'VR / AR headset' not in out:
        out.append('Wearable / head-mounted')
    if re.search(r'scre+n|scree|desktop|monitor|display', s): out.append('Screen-based')
    if re.search(r'phone|mobile device|tablet', s): out.append('Phone / tablet')
    if re.search(r'rgb|webcam|camera', s) and not out: out.append('RGB camera')
    return out or ['Other / unclear']

def f_mobility(v):
    s = norm(v)
    if not s or s in BLANK: return 'Unclear'
    has_static = 'static' in s or 'stationary' in s
    has_mobile = 'mobile' in s or 'mobie' in s or 'moblie' in s
    if has_static and has_mobile: return 'Both'
    if has_mobile: return 'Mobile'
    if has_static: return 'Static'
    if 'car' in s: return 'Mobile'
    return 'Unclear'

def f_setting(v):
    s = norm(v)
    if not s or s in BLANK: return 'Unclear'
    wild = bool(re.search(r'wild|outdoor|natural|urban|field', s))
    lab = 'lab' in s or 'simulator' in s or 'emulation' in s
    remote = 'remote' in s or 'online' in s or 'crowd' in s
    if remote: return 'Remote / online'
    if wild and lab: return 'Lab and field'
    if wild: return 'In the wild'
    if lab or 'vr' in s: return 'Lab'
    return 'Unclear'

def f_availability(v):
    s = norm(v)
    if 'request' in s: return 'On request'
    if 'broken' in s or 'does not work' in s or 'does not contain' in s or 'link is broken' in s:
        return 'Link broken'
    if s.startswith('yes'): return 'Available'
    if s in ('no', 'not yet'): return 'Not available'
    return 'Unclear'

def f_posture(v):
    s = norm(v)
    if not s or s in BLANK: return ['Not stated']
    out = []
    if 'sit' in s: out.append('Sitting')
    if 'stand' in s or 'standng' in s: out.append('Standing')
    if 'walk' in s: out.append('Walking')
    return out

def f_yesno(v, yes_kw=('yes',), no_kw=('no',)):
    s = norm(v)
    if not s or s in ('', '-', 'nan', 'not specified', 'not clear', 'unspecified',
                      'not applicable', 'not mentioned', 'various (not stated in paper)'):
        return 'Not stated'
    if s.startswith('no ') or s == 'no' or s.startswith('no,') or s.startswith('no but'):
        return 'No'
    if any(k in s for k in yes_kw) or re.match(r'^\d+[\s-]?point', s) or 'chinrest' in s \
       or 'chin' in s or 'headrest' in s or 'head rest' in s:
        return 'Yes'
    if any(s.startswith(k) for k in no_kw): return 'No'
    return 'Yes'

def f_calibration(v):
    s = norm(v)
    if not s or s in ('', '-', 'nan', 'not specified', 'not clear', 'unspecified',
                      'not applicable', 'various (not stated in paper)'): return 'Not stated'
    if s == 'no' or s.startswith('no '): return 'No'
    if 'yes' in s or re.search(r'\d+[\s-]?point|calibrat', s): return 'Yes'
    return 'Not stated'

def f_chinrest(v):
    s = norm(v)
    if not s or s in ('', '-', 'nan', 'not specified', 'not clear', 'unspecified',
                      'not applicable', 'various (not stated in paper)'): return 'Not stated'
    if re.search(r'chin|head\s?rest|headrest|forehead', s): return 'Yes'
    if s.startswith('yes'): return 'Yes'
    if s.startswith('no'): return 'No'
    return 'Not stated'

def f_privacy(v):
    s = norm(v)
    if s.startswith('yes'): return 'Yes'
    if s.startswith('no') or s == 'no': return 'No'
    return 'Not stated'

def f_envcam(v):
    s = norm(v)
    if not s or s in ('', '-', 'nan', 'not specified', 'not clear', 'unspecified',
                      'not applicable'): return 'Not stated'
    if s.startswith('no'): return 'No'
    if 'yes' in s or 'camera' in s or 'vr' in s or 'cockpit' in s or 'path' in s: return 'Yes'
    return 'Not stated'

def parse_n(v):
    s = clean(v)
    m = re.search(r'\d+', s.replace(',', ''))
    return int(m.group()) if m else None

def n_bucket(n):
    if n is None: return 'Not stated'
    if n < 10: return '1\u20139'
    if n < 20: return '10\u201319'
    if n < 50: return '20\u201349'
    if n < 100: return '50\u201399'
    return '100+'

def parse_year(*vals):
    for v in vals:
        m = re.search(r'(19|20)\d{2}', clean(v))
        if m: return int(m.group())
    return None

def parse_freq(v):
    s = clean(v).lower().replace(',', '')
    m = re.search(r'(\d+(?:\.\d+)?)\s*(?:hz|fps)?', s)
    if not m: return None
    try: return float(m.group(1))
    except ValueError: return None

def freq_bucket(f):
    if f is None: return 'Not stated'
    if f < 60: return 'Under 60 Hz'
    if f < 120: return '60\u2013119 Hz'
    if f < 250: return '120\u2013249 Hz'
    if f < 1000: return '250\u2013999 Hz'
    return '1000 Hz and above'

# --------------------------------------------- reporting-completeness axes
REPORT_FIELDS = [
    ('Gender', 'Gender'),
    ('Age', 'Age'),
    ('Average age', 'Mean age'),
    ('Background', 'Background'),
    ('Gaze correction', 'Vision correction'),
    ('Ethnicity/nationality/race', 'Ethnicity'),
    ('inclusion and exclusion critria', 'Inclusion criteria'),
    ('Major', 'Field of study'),
    ('other demographics', 'Other demographics'),
    ('Eye diseases reporting', 'Eye disease'),
    ('Reading direction', 'Reading direction'),
    ('Dominant hand', 'Dominant hand'),
    ('Eye tracking experience', 'Prior ET experience'),
    ('Dominent eye', 'Dominant eye'),
    ('IPDs', 'Interpupillary distance'),
    ('Makeup/fake lashes etc', 'Makeup / lashes'),
    ('Eye Lid', 'Eyelid'),
    ('letter contrast sensitivity', 'Contrast sensitivity'),
    ('Retinal defect', 'Retinal defect'),
    ('Face coverage', 'Face coverage'),
    ('Pupil size', 'Pupil size'),
]

# ------------------------------------------------------------ detail groups
GROUPS = [
    ('Publication', ['Paper Title', '__authors__', 'Year published', 'Dataset publication year',
                     'Dataset published at ETRA?', 'ETRA Paper Type', 'Dataset available?',
                     'Data privacy Mentioned']),
    ('Apparatus', ['Hardware', 'static vs. Mobile', 'screen based, VR or wearable, RGB',
                   'frequency', 'screen resoultion or camera resolution', 'Visual angle',
                   'eye tracker accuracy', 'Camera recording the environment?']),
    ('Data', ['Data type collected', 'Data type published', 'Data analysed',
              'Data Cleaning', 'Data size']),
    ('Procedure', ['Task', 'Task duration', 'Lab vs. Wild vs remote study', 'Calibration needed',
                   'Chinrest and other constraints', 'Distance to stimuli',
                   'Standing, sitting, walking', 'Study time in the day', 'screen luminance',
                   'Light control']),
    ('Participants', ['N=?', 'Gender', 'Gender (detail 2)', 'Gender (detail 3)', 'Age',
                      'Average age', 'Background', 'Major', 'Compensation mentioned ?',
                      'Ethnicity/nationality/race', 'inclusion and exclusion critria',
                      'other demographics']),
    ('Vision and eye characteristics', ['Gaze correction', 'Eye tracking experience',
                                        'Reading direction', 'Dominant hand', 'Dominent eye',
                                        'letter contrast sensitivity', 'Retinal defect',
                                        'Eye Lid', 'Eye diseases reporting', 'Face coverage',
                                        'Makeup/fake lashes etc', 'Pupil size', 'IPDs']),
]

LABELS = {
    'Paper Title': 'Paper title', '__authors__': 'Authors', 'Year published': 'Paper year',
    'Dataset publication year': 'Dataset year', 'Dataset published at ETRA?': 'Published at ETRA',
    'ETRA Paper Type': 'ETRA paper type', 'Dataset available?': 'Availability (as recorded)',
    'Data privacy Mentioned': 'Privacy mentioned', 'Hardware': 'Eye tracker',
    'static vs. Mobile': 'Static or mobile', 'screen based, VR or wearable, RGB': 'Platform',
    'frequency': 'Sampling rate', 'screen resoultion or camera resolution': 'Resolution',
    'Visual angle': 'Visual angle', 'eye tracker accuracy': 'Reported accuracy',
    'Camera recording the environment?': 'Scene camera', 'Data type collected': 'Data collected',
    'Data type published': 'Data released', 'Data analysed': 'Data analysed',
    'Data Cleaning': 'Cleaning procedure', 'Data size': 'Volume', 'Task': 'Task',
    'Task duration': 'Duration', 'Lab vs. Wild vs remote study': 'Setting',
    'Calibration needed': 'Calibration', 'Chinrest and other constraints': 'Head restraint',
    'Distance to stimuli': 'Viewing distance', 'Standing, sitting, walking': 'Posture',
    'Study time in the day': 'Time of day', 'screen luminance': 'Screen luminance',
    'Light control': 'Lighting control', 'N=?': 'Participants',
    'Gender': 'Gender', 'Gender (detail 2)': 'Gender, further detail',
    'Gender (detail 3)': 'Gender, additional notes', 'Age': 'Age', 'Average age': 'Mean age',
    'Background': 'Participant background', 'Major': 'Field of study',
    'Compensation mentioned ?': 'Compensation', 'Ethnicity/nationality/race': 'Ethnicity',
    'inclusion and exclusion critria': 'Inclusion and exclusion criteria',
    'other demographics': 'Other demographics', 'Gaze correction': 'Vision correction',
    'Eye tracking experience': 'Prior eye-tracking experience',
    'Reading direction': 'Reading direction', 'Dominant hand': 'Dominant hand',
    'Dominent eye': 'Dominant eye', 'letter contrast sensitivity': 'Contrast sensitivity',
    'Retinal defect': 'Retinal defect', 'Eye Lid': 'Eyelid', 'Eye diseases reporting': 'Eye disease',
    'Face coverage': 'Face coverage', 'Makeup/fake lashes etc': 'Makeup and lashes',
    'Pupil size': 'Pupil size', 'IPDs': 'Interpupillary distance',
}

def bib(v):
    """Preserve BibTeX line structure; only normalise escaped newlines."""
    if not v: return ''
    s = str(v).replace('\\n', '\n').replace('\r\n', '\n').replace('\r', '\n')
    s = '\n'.join(line.rstrip() for line in s.split('\n'))
    return s.strip()

records = []
for i, row in df.iterrows():
    name = clean(row['Dataset name']) or 'Untitled dataset'
    n = parse_n(row['N=?'])
    dyear = parse_year(row['Dataset publication year'])
    pyear = parse_year(row['Year published'])
    year = dyear or pyear
    freq = parse_freq(row['frequency'])

    reports = {}
    for col, label in REPORT_FIELDS:
        reports[label] = bool(is_reported(row[col]))
    score = sum(reports.values())

    hw = clean(row['Hardware'])

    paper_authors = parse_authors(bib(row['Paper BibTeX']))
    dataset_authors = parse_authors(bib(row['Dataset BibTeX']))
    authors = paper_authors or dataset_authors
    author_count = len(authors)
    author_short = author_line(authors, 3)               # surnames, "et al." beyond 3 - card byline
    author_full = author_line_full(authors)              # every surname - detail panel
    author_display = (f'{author_short} ({author_count} author'
                       f'{"s" if author_count != 1 else ""})') if author_count else ''
    author_panel_value = (f'{author_full} ({author_count} author'
                           f'{"s" if author_count != 1 else ""})') if author_count else ''

    groups = []
    for gname, cols in GROUPS:
        items = []
        for c in cols:
            if c == '__authors__':
                items.append({'label': LABELS[c], 'value': author_panel_value,
                              'reported': author_count > 0})
                continue
            val = clean(row[c])
            items.append({'label': LABELS.get(c, c), 'value': val,
                          'reported': bool(is_reported(row[c]))})
        groups.append({'name': gname, 'items': items})

    records.append({
        'id': i,
        'name': name,
        'paper': clean(row['Paper Title']),
        'datasetLink': clean(row['Dataset link']),
        'paperLink': clean(row['Paper link']),
        'pubLink': clean(row['Dataset Publication link']),
        'datasetBib': bib(row['Dataset BibTeX']),
        'paperBib': bib(row['Paper BibTeX']),
        'year': year,
        'paperYear': pyear,
        'n': n,
        'nBucket': n_bucket(n),
        'nRaw': clean(row['N=?']),
        'hardware': hw if is_reported(hw) else '',
        'trackerBrands': tracker_brands(hw),
        'trackerModels': tracker_models(hw),
        'authorCount': author_count,
        'authorLine': author_short,
        'authorDisplay': author_display,
        'freq': freq,
        'freqBucket': freq_bucket(freq),
        'freqRaw': clean(row['frequency']),
        'task': clean(row['Task']),
        'modality': f_modality(row['screen based, VR or wearable, RGB']),
        'mobility': f_mobility(row['static vs. Mobile']),
        'setting': f_setting(row['Lab vs. Wild vs remote study']),
        'availability': f_availability(row['Dataset available?']),
        'etra': 'ETRA' if norm(row['Dataset published at ETRA?']).startswith('yes') else 'Other venue',
        'posture': f_posture(row['Standing, sitting, walking']),
        'calibration': f_calibration(row['Calibration needed']),
        'chinrest': f_chinrest(row['Chinrest and other constraints']),
        'privacy': f_privacy(row['Data privacy Mentioned']),
        'envCam': f_envcam(row['Camera recording the environment?']),
        'reports': reports,
        'score': score,
        'groups': groups,
    })

# de-duplicate identical dataset names by appending paper year
seen = {}
for r in records:
    k = r['name'].lower()
    seen.setdefault(k, []).append(r)
for k, rs in seen.items():
    if len(rs) > 1:
        for r in rs:
            if r['year']: r['name'] = f"{r['name']} ({r['year']})"

REPORT_LABELS = [lbl for _, lbl in REPORT_FIELDS]
meta = {
    'total': len(records),
    'reportFields': REPORT_LABELS,
    'coverage': {lbl: sum(1 for r in records if r['reports'][lbl]) for lbl in REPORT_LABELS},
    'years': sorted({r['year'] for r in records if r['year']}),
}

out = {'meta': meta, 'records': records}
with open('/home/claude/data.json', 'w') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

# ---- sanity report
print('records:', len(records))
for key in ['modality', 'mobility', 'setting', 'availability', 'etra', 'calibration',
            'chinrest', 'privacy', 'envCam', 'nBucket', 'freqBucket', 'trackerBrands']:
    from collections import Counter
    c = Counter()
    for r in records:
        v = r[key]
        if isinstance(v, list):
            c.update(v or ['(none)'])
        else:
            c[v] += 1
    print(f'-- {key}: {dict(c.most_common())}')
print('coverage:', meta['coverage'])
print('score range:', min(r['score'] for r in records), max(r['score'] for r in records))
import os; print('json KB:', os.path.getsize('/home/claude/data.json')//1024)
