"""
Tools AI — Pitch Deck Generator
Matches the website's design: pure black background, orange accent (#EA580C),
layered white text, sparse ambient starfield, tight bold typography.

Output: 13.33" x 7.5" widescreen (16:9), optimized for investor/partner meetings.
"""

import random
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Page size: 13.33" x 7.5" widescreen (960 x 540 pt) ──────────────
WIDTH = 13.333 * inch  # 960 pt
HEIGHT = 7.5 * inch    # 540 pt

# ── Color palette (from the website) ──────────────────────────────
BG = HexColor("#000000")
BG_ELEV = HexColor("#0a0a0a")
SURFACE = HexColor("#141414")
TEXT = HexColor("#ededec")
TEXT_SEC = Color(0.929, 0.925, 0.925, 0.70)  # rgba(237,236,236,0.70)
TEXT_TERT = Color(0.929, 0.925, 0.925, 0.45)
BORDER = Color(1, 1, 1, 0.10)
BORDER_MED = Color(1, 1, 1, 0.18)
ACCENT = HexColor("#EA580C")
ACCENT_SOFT = Color(0.918, 0.345, 0.047, 0.15)
SUCCESS = HexColor("#40c977")
STAR = Color(1, 1, 1, 0.65)
STAR_BRIGHT = Color(1, 1, 1, 1.0)
STAR_DIM = Color(1, 1, 1, 0.3)

# Fonts — ReportLab's built-in Helvetica is similar to Inter for PDF
FONT_SANS = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
FONT_MONO = "Courier"
FONT_MONO_BOLD = "Courier-Bold"


def draw_starfield(c, density=70, seed=1):
    """Paint a sparse starfield as the page background."""
    rng = random.Random(seed)
    for _ in range(density):
        x = rng.random() * WIDTH
        y = rng.random() * HEIGHT
        r = rng.choice([0.5, 0.7, 1.0, 1.3])
        alpha = rng.choice([0.3, 0.5, 0.7, 0.9])
        c.setFillColor(Color(1, 1, 1, alpha))
        c.circle(x, y, r, stroke=0, fill=1)


def page_bg(c, seed=1):
    """Black page with a sparse starfield."""
    c.setFillColor(BG)
    c.rect(0, 0, WIDTH, HEIGHT, stroke=0, fill=1)
    draw_starfield(c, density=80, seed=seed)


def draw_kicker(c, x, y, text, color=ACCENT):
    """Small uppercase label above a section headline."""
    c.setFont(FONT_BOLD, 10)
    c.setFillColor(color)
    c.drawString(x, y, text.upper())


def draw_page_number(c, page_num, total):
    """Bottom-right slide counter."""
    c.setFont(FONT_SANS, 9)
    c.setFillColor(TEXT_TERT)
    c.drawRightString(WIDTH - 36, 24, f"{page_num} / {total}")

    # Brand footer
    c.setFillColor(TEXT_TERT)
    c.setFont(FONT_SANS, 9)
    c.drawString(36, 24, "Tools AI · thetoolswebsite.com")


def draw_logo_word(c, x, y, size=14):
    """Simple 'Tools AI' wordmark with a small orange dot."""
    c.setFillColor(ACCENT)
    c.circle(x + 3, y + 5, 3, stroke=0, fill=1)
    c.setFillColor(TEXT)
    c.setFont(FONT_BOLD, size)
    c.drawString(x + 14, y, "Tools AI")


def draw_pill(c, x, y, text, filled=True, color=ACCENT):
    """Rounded pill label."""
    c.setFont(FONT_BOLD, 9)
    w = c.stringWidth(text, FONT_BOLD, 9) + 22
    h = 22
    if filled:
        c.setFillColor(ACCENT_SOFT)
        c.setStrokeColor(color)
        c.setLineWidth(0.6)
        c.roundRect(x, y, w, h, 11, stroke=1, fill=1)
        c.setFillColor(color)
    else:
        c.setFillColor(Color(1, 1, 1, 0.06))
        c.setStrokeColor(BORDER_MED)
        c.setLineWidth(0.6)
        c.roundRect(x, y, w, h, 11, stroke=1, fill=1)
        c.setFillColor(TEXT_SEC)
    c.drawString(x + 11, y + 6, text)


def draw_bullet(c, x, y, text, color=ACCENT, body_color=TEXT, size=13):
    """Bullet point with colored marker."""
    c.setFillColor(color)
    c.setFont(FONT_BOLD, size + 2)
    c.drawString(x, y, "•")
    c.setFillColor(body_color)
    c.setFont(FONT_SANS, size)
    c.drawString(x + 18, y, text)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 1: Cover
# ═══════════════════════════════════════════════════════════════════
def slide_cover(c):
    page_bg(c, seed=1)

    # Nav bar
    draw_logo_word(c, 48, HEIGHT - 56, size=14)
    c.setFont(FONT_SANS, 10)
    c.setFillColor(TEXT_TERT)
    c.drawRightString(WIDTH - 48, HEIGHT - 51, "Pitch Deck · 2026")

    # Status pill
    pill_y = HEIGHT / 2 + 120
    draw_pill(c, WIDTH / 2 - 115, pill_y, "v2.0.3 — Now live on macOS", filled=False)
    # Green dot inside pill
    c.setFillColor(SUCCESS)
    c.circle(WIDTH / 2 - 102, pill_y + 11, 3, stroke=0, fill=1)

    # Main headline — huge, two-line
    c.setFont(FONT_BOLD, 76)
    c.setFillColor(TEXT)
    c.drawCentredString(WIDTH / 2, HEIGHT / 2 + 30, "Every AI.")
    c.setFillColor(ACCENT)
    c.drawCentredString(WIDTH / 2, HEIGHT / 2 - 40, "One workspace.")

    # Subheadline
    c.setFont(FONT_SANS, 16)
    c.setFillColor(TEXT_SEC)
    c.drawCentredString(WIDTH / 2, HEIGHT / 2 - 88,
        "Claude, GPT-4o, Gemini, Grok, and Perplexity")
    c.drawCentredString(WIDTH / 2, HEIGHT / 2 - 108,
        "collaborating on your code in parallel.")

    # Footer
    c.setFont(FONT_SANS, 10)
    c.setFillColor(TEXT_TERT)
    c.drawCentredString(WIDTH / 2, 60, "Dylan Wain · hello@thetoolswebsite.com · thetoolswebsite.com")


# ═══════════════════════════════════════════════════════════════════
# SLIDE 2: The Problem
# ═══════════════════════════════════════════════════════════════════
def slide_problem(c):
    page_bg(c, seed=2)
    draw_logo_word(c, 48, HEIGHT - 56)

    draw_kicker(c, 72, HEIGHT - 140, "The problem", color=ACCENT)

    c.setFont(FONT_BOLD, 44)
    c.setFillColor(TEXT)
    c.drawString(72, HEIGHT - 210, "Developers are")
    c.drawString(72, HEIGHT - 260, "drowning in AI tools.")

    # Three pain points on the right
    pain_x = WIDTH / 2 + 40
    pain_ys = [HEIGHT - 180, HEIGHT - 260, HEIGHT - 340]
    pains = [
        ("5 subscriptions, 5 tabs",
         "ChatGPT, Claude, Gemini, Grok, Perplexity — each a separate window, login, and bill."),
        ("No way to compare answers",
         "Which model is right this time? Copy-paste the same prompt into five tabs to find out."),
        ("Context lives nowhere",
         "Your design docs, API specs, and codebase don't follow the conversation."),
    ]
    for (title, body), py in zip(pains, pain_ys):
        c.setFillColor(ACCENT)
        c.setFont(FONT_BOLD, 14)
        c.drawString(pain_x, py, "→")
        c.setFillColor(TEXT)
        c.setFont(FONT_BOLD, 15)
        c.drawString(pain_x + 24, py, title)
        c.setFillColor(TEXT_SEC)
        c.setFont(FONT_SANS, 11)
        # Wrap body
        words = body.split(" ")
        lines, cur = [], ""
        for w in words:
            test = (cur + " " + w).strip()
            if c.stringWidth(test, FONT_SANS, 11) < 340:
                cur = test
            else:
                lines.append(cur)
                cur = w
        if cur: lines.append(cur)
        for i, line in enumerate(lines):
            c.drawString(pain_x + 24, py - 18 - i * 14, line)

    draw_page_number(c, 2, 12)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 3: The Solution
# ═══════════════════════════════════════════════════════════════════
def slide_solution(c):
    page_bg(c, seed=3)
    draw_logo_word(c, 48, HEIGHT - 56)

    draw_kicker(c, 72, HEIGHT - 140, "The solution")

    c.setFont(FONT_BOLD, 52)
    c.setFillColor(TEXT)
    c.drawString(72, HEIGHT - 215, "Tools AI.")

    c.setFont(FONT_SANS, 18)
    c.setFillColor(TEXT_SEC)
    c.drawString(72, HEIGHT - 250, "One IDE. Five AI providers. Collaborating on your code.")

    # Big number callouts
    stats_y = HEIGHT - 370
    stats = [
        ("5", "AI models\nbuilt in"),
        ("1", "subscription\n($25/mo)"),
        ("0", "tabs to\nswitch between"),
        ("∞", "context\npreserved"),
    ]
    stat_x = 72
    stat_spacing = (WIDTH - 144) / len(stats)
    for i, (num, label) in enumerate(stats):
        x = stat_x + i * stat_spacing
        # Card bg
        c.setFillColor(SURFACE)
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.6)
        c.roundRect(x, stats_y - 80, stat_spacing - 20, 140, 12, stroke=1, fill=1)
        # Big number
        c.setFont(FONT_BOLD, 72)
        c.setFillColor(ACCENT)
        c.drawString(x + 24, stats_y - 30, num)
        # Label
        c.setFont(FONT_SANS, 12)
        c.setFillColor(TEXT_SEC)
        for j, ln in enumerate(label.split("\n")):
            c.drawString(x + 24, stats_y - 58 - j * 14, ln)

    draw_page_number(c, 3, 12)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 4: How it works
# ═══════════════════════════════════════════════════════════════════
def slide_how_it_works(c):
    page_bg(c, seed=4)
    draw_logo_word(c, 48, HEIGHT - 56)

    draw_kicker(c, 72, HEIGHT - 140, "How it works")
    c.setFont(FONT_BOLD, 42)
    c.setFillColor(TEXT)
    c.drawString(72, HEIGHT - 205, "Five models. One conversation.")

    c.setFont(FONT_SANS, 14)
    c.setFillColor(TEXT_SEC)
    c.drawString(72, HEIGHT - 235, "Ask once. All five models work in parallel. Phase 2 has them refine each other's output.")

    # Model cards row
    models = [
        ("Claude",     HexColor("#d97706")),
        ("GPT-4o",     HexColor("#10a37f")),
        ("Gemini",     HexColor("#4285F4")),
        ("Grok",       HexColor("#888888")),
        ("Perplexity", HexColor("#20808d")),
    ]
    card_y = HEIGHT - 380
    card_w = 150
    gap = 18
    total_w = len(models) * card_w + (len(models) - 1) * gap
    start_x = (WIDTH - total_w) / 2

    for i, (name, color) in enumerate(models):
        x = start_x + i * (card_w + gap)
        # Card
        c.setFillColor(SURFACE)
        c.setStrokeColor(color)
        c.setLineWidth(1.2)
        c.roundRect(x, card_y - 110, card_w, 110, 10, stroke=1, fill=1)
        # Colored dot
        c.setFillColor(color)
        c.circle(x + 20, card_y - 28, 8, stroke=0, fill=1)
        # Name
        c.setFont(FONT_BOLD, 14)
        c.setFillColor(TEXT)
        c.drawString(x + 36, card_y - 32, name)
        # Status
        c.setFont(FONT_MONO, 9)
        c.setFillColor(TEXT_TERT)
        c.drawString(x + 14, card_y - 56, "> analyzing...")
        c.drawString(x + 14, card_y - 70, "> generating...")
        c.drawString(x + 14, card_y - 84, "> refining...")
        # Done
        c.setFillColor(SUCCESS)
        c.setFont(FONT_BOLD, 9)
        c.drawString(x + 14, card_y - 100, "✓ Final")

    # Caption below
    c.setFont(FONT_SANS, 11)
    c.setFillColor(TEXT_TERT)
    c.drawCentredString(WIDTH / 2, card_y - 140,
        "Phase 1: Parallel execution → Phase 2: Shared context refinement → Best-of-all output")

    draw_page_number(c, 4, 12)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 5: Features
# ═══════════════════════════════════════════════════════════════════
def slide_features(c):
    page_bg(c, seed=5)
    draw_logo_word(c, 48, HEIGHT - 56)

    draw_kicker(c, 72, HEIGHT - 140, "The product")
    c.setFont(FONT_BOLD, 42)
    c.setFillColor(TEXT)
    c.drawString(72, HEIGHT - 205, "Everything a dev workflow needs.")

    features = [
        ("AI Builder",        "5-model parallel orchestration with shared-context Phase 2 refinement."),
        ("Meeting Recorder",  "Whisper transcription + Claude task extraction → execute against your code."),
        ("Live Preview",      "HTTP server + floating AI edit overlay. Describe a change, code updates."),
        ("Smart Terminal",    "Shell commands work normally. Natural language goes to AI. Same keystrokes."),
        ("Context Library",   "Upload files once. Injected into every AI call across the whole workspace."),
        ("Diff Review",       "Cursor-style accept/reject for every AI-generated change. Nothing auto-commits."),
        ("Profile System",    "Eight curated loadouts. Curated extensions, settings, AI defaults per workflow."),
        ("Self-Healing Loop", "AI writes code → runs the build → reads errors → fixes → retries up to 3x."),
    ]

    col_w = (WIDTH - 144) / 2 - 12
    row_h = 78
    for i, (title, body) in enumerate(features):
        col = i % 2
        row = i // 2
        x = 72 + col * (col_w + 24)
        y = HEIGHT - 260 - row * row_h

        # Icon dot
        c.setFillColor(ACCENT)
        c.circle(x + 6, y, 4, stroke=0, fill=1)
        # Title
        c.setFont(FONT_BOLD, 14)
        c.setFillColor(TEXT)
        c.drawString(x + 20, y - 4, title)
        # Body
        c.setFont(FONT_SANS, 10.5)
        c.setFillColor(TEXT_SEC)
        # Simple wrap
        words = body.split(" ")
        lines, cur = [], ""
        for w in words:
            test = (cur + " " + w).strip()
            if c.stringWidth(test, FONT_SANS, 10.5) < col_w - 30:
                cur = test
            else:
                lines.append(cur)
                cur = w
        if cur: lines.append(cur)
        for j, ln in enumerate(lines[:2]):
            c.drawString(x + 20, y - 24 - j * 13, ln)

    draw_page_number(c, 5, 12)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 6: Why we're different
# ═══════════════════════════════════════════════════════════════════
def slide_differentiation(c):
    page_bg(c, seed=6)
    draw_logo_word(c, 48, HEIGHT - 56)

    draw_kicker(c, 72, HEIGHT - 140, "Why we're different")
    c.setFont(FONT_BOLD, 42)
    c.setFillColor(TEXT)
    c.drawString(72, HEIGHT - 205, "Cursor gives you one AI.")
    c.drawString(72, HEIGHT - 252, "We give you all of them — collaborating.")

    # Comparison table
    table_y = HEIGHT - 320
    col_labels = ["Feature", "Cursor", "Tools AI"]
    col_xs = [72, 500, 720]
    rows = [
        ("Multiple models on same task",     "Tournament (pick winner)", "Shared context refinement"),
        ("Providers included",                "1 at a time",              "5 (Claude + GPT + Gemini + Grok + PPX)"),
        ("Meeting → code pipeline",           "—",                        "Whisper + Claude + executor"),
        ("Curated extension profiles",        "—",                        "8 profiles, zero config"),
        ("Persistent context library",        "Per-conversation",         "Workspace-wide, always"),
        ("Price",                             "$20/mo · 1 provider",      "$25/mo · 5 providers"),
    ]

    # Header
    c.setFont(FONT_BOLD, 11)
    c.setFillColor(TEXT_TERT)
    for x, label in zip(col_xs, col_labels):
        c.drawString(x, table_y, label.upper())
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.line(72, table_y - 8, WIDTH - 72, table_y - 8)

    # Rows
    for i, (feat, cursor, ours) in enumerate(rows):
        y = table_y - 30 - i * 28
        c.setFont(FONT_SANS, 11)
        c.setFillColor(TEXT)
        c.drawString(col_xs[0], y, feat)
        c.setFillColor(TEXT_TERT)
        c.drawString(col_xs[1], y, cursor)
        c.setFillColor(ACCENT)
        c.setFont(FONT_BOLD, 11)
        c.drawString(col_xs[2], y, ours)
        # Row separator
        c.setStrokeColor(BORDER)
        c.line(72, y - 10, WIDTH - 72, y - 10)

    draw_page_number(c, 6, 12)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 7: Market
# ═══════════════════════════════════════════════════════════════════
def slide_market(c):
    page_bg(c, seed=7)
    draw_logo_word(c, 48, HEIGHT - 56)

    draw_kicker(c, 72, HEIGHT - 140, "The market")
    c.setFont(FONT_BOLD, 42)
    c.setFillColor(TEXT)
    c.drawString(72, HEIGHT - 205, "The AI-IDE category is exploding.")

    # Big stats row
    stats = [
        ("$5B+",      "AI developer tools market (2026)"),
        ("26M",       "VS Code users worldwide"),
        ("$500M+",    "Cursor ARR (2025)"),
        ("$25/mo",    "Typical SaaS dev tool price"),
    ]
    sy = HEIGHT - 330
    sx_spacing = (WIDTH - 144) / len(stats)
    for i, (num, label) in enumerate(stats):
        x = 72 + i * sx_spacing
        c.setFont(FONT_BOLD, 44)
        c.setFillColor(ACCENT)
        c.drawString(x, sy, num)
        c.setFont(FONT_SANS, 11)
        c.setFillColor(TEXT_SEC)
        # Wrap label to ~22 chars
        words = label.split(" ")
        lines, cur = [], ""
        for w in words:
            test = (cur + " " + w).strip()
            if c.stringWidth(test, FONT_SANS, 11) < sx_spacing - 20:
                cur = test
            else:
                lines.append(cur)
                cur = w
        if cur: lines.append(cur)
        for j, ln in enumerate(lines):
            c.drawString(x, sy - 20 - j * 14, ln)

    # Thesis
    c.setFont(FONT_SANS, 14)
    c.setFillColor(TEXT_SEC)
    c.drawString(72, HEIGHT - 440,
        "Cursor proved developers pay for AI-first IDEs.")
    c.drawString(72, HEIGHT - 460,
        "But 'best AI' is a moving target. Multi-model orchestration wins long-term.")

    draw_page_number(c, 7, 12)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 8: Business model
# ═══════════════════════════════════════════════════════════════════
def slide_business(c):
    page_bg(c, seed=8)
    draw_logo_word(c, 48, HEIGHT - 56)

    draw_kicker(c, 72, HEIGHT - 140, "Business model")
    c.setFont(FONT_BOLD, 42)
    c.setFillColor(TEXT)
    c.drawString(72, HEIGHT - 205, "Simple. Honest. All models included.")

    # Three pricing cards
    card_y = HEIGHT - 420
    card_h = 200
    card_w = (WIDTH - 144 - 48) / 3

    plans = [
        ("Free Trial", "$0", "14 days", False,
         ["All 5 AI models", "Unlimited usage", "No credit card"]),
        ("Chad",       "$25", "per month", True,
         ["All 5 AI models always", "$15 of usage included",
          "Meeting + context + profiles", "Priority updates"]),
        ("Pay-as-you-go", "$0", "base + usage", False,
         ["Pay only for what you use", "All 5 models available",
          "$0.03/credit metered"]),
    ]
    for i, (name, price, period, highlight, feats) in enumerate(plans):
        x = 72 + i * (card_w + 24)
        # BG
        if highlight:
            c.setFillColor(ACCENT_SOFT)
            c.setStrokeColor(ACCENT)
            c.setLineWidth(1.2)
        else:
            c.setFillColor(SURFACE)
            c.setStrokeColor(BORDER)
            c.setLineWidth(0.6)
        c.roundRect(x, card_y, card_w, card_h, 12, stroke=1, fill=1)

        # Name
        c.setFont(FONT_BOLD, 11)
        c.setFillColor(ACCENT if highlight else TEXT_SEC)
        c.drawString(x + 20, card_y + card_h - 28, name.upper())

        # Price
        c.setFont(FONT_BOLD, 36)
        c.setFillColor(TEXT)
        c.drawString(x + 20, card_y + card_h - 70, price)
        c.setFont(FONT_SANS, 11)
        c.setFillColor(TEXT_TERT)
        c.drawString(x + 20 + c.stringWidth(price, FONT_BOLD, 36) + 8,
                     card_y + card_h - 70, period)

        # Features
        for j, f in enumerate(feats):
            c.setFillColor(ACCENT if highlight else SUCCESS)
            c.setFont(FONT_BOLD, 10)
            c.drawString(x + 20, card_y + card_h - 100 - j * 18, "✓")
            c.setFillColor(TEXT_SEC)
            c.setFont(FONT_SANS, 10)
            c.drawString(x + 32, card_y + card_h - 100 - j * 18, f)

        if highlight:
            c.setFillColor(ACCENT)
            c.setFont(FONT_BOLD, 9)
            tag_w = c.stringWidth("MOST POPULAR", FONT_BOLD, 9) + 20
            c.roundRect(x + card_w - tag_w - 14, card_y + card_h - 18,
                        tag_w, 18, 9, stroke=0, fill=1)
            c.setFillColor(BG)
            c.drawString(x + card_w - tag_w - 4, card_y + card_h - 12, "MOST POPULAR")

    # Unit economics strip
    c.setFont(FONT_SANS, 12)
    c.setFillColor(TEXT_SEC)
    c.drawString(72, card_y - 34,
        "Cost to serve per Chad user: ~$8/mo in API fees. Gross margin ~68%. Stripe metered overage at $0.02/credit.")

    draw_page_number(c, 8, 12)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 9: Traction
# ═══════════════════════════════════════════════════════════════════
def slide_traction(c):
    page_bg(c, seed=9)
    draw_logo_word(c, 48, HEIGHT - 56)

    draw_kicker(c, 72, HEIGHT - 140, "Traction")
    c.setFont(FONT_BOLD, 42)
    c.setFillColor(TEXT)
    c.drawString(72, HEIGHT - 205, "Shipped. Signed. Notarized.")

    # Timeline of releases
    ty = HEIGHT - 280
    c.setFont(FONT_BOLD, 12)
    c.setFillColor(ACCENT)
    c.drawString(72, ty, "RELEASE TIMELINE")

    releases = [
        ("v1.0.0", "Apr 10", "First shipped build (universal)"),
        ("v2.0.0", "Apr 13", "Multi-model orchestration"),
        ("v2.0.1", "Apr 14", "Meeting recorder"),
        ("v2.0.2", "Apr 14", "Context library + live preview"),
        ("v2.0.3", "Apr 15", "Profile system + auto-install + signed universal DMG"),
    ]
    for i, (v, date, desc) in enumerate(releases):
        y = ty - 26 - i * 24
        c.setFillColor(ACCENT)
        c.setFont(FONT_MONO_BOLD, 11)
        c.drawString(72, y, v)
        c.setFillColor(TEXT_TERT)
        c.setFont(FONT_MONO, 11)
        c.drawString(132, y, date)
        c.setFillColor(TEXT)
        c.setFont(FONT_SANS, 12)
        c.drawString(200, y, desc)

    # Right side: key numbers
    rx = WIDTH / 2 + 80
    c.setFont(FONT_BOLD, 12)
    c.setFillColor(ACCENT)
    c.drawString(rx, ty, "CURRENT STATE")

    metrics = [
        ("Live users",         "3 paying (founder-led)"),
        ("App status",         "Signed, notarized, stapled"),
        ("Platform",           "macOS universal (Intel + Apple Silicon)"),
        ("Infrastructure",     "Vercel + Supabase + Stripe, production"),
        ("Install footprint",  "Open VSX marketplace, 8 profiles live"),
    ]
    for i, (label, val) in enumerate(metrics):
        y = ty - 26 - i * 24
        c.setFont(FONT_SANS, 10)
        c.setFillColor(TEXT_TERT)
        c.drawString(rx, y + 6, label.upper())
        c.setFont(FONT_BOLD, 12)
        c.setFillColor(TEXT)
        c.drawString(rx, y - 8, val)

    draw_page_number(c, 9, 12)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 10: Roadmap
# ═══════════════════════════════════════════════════════════════════
def slide_roadmap(c):
    page_bg(c, seed=10)
    draw_logo_word(c, 48, HEIGHT - 56)

    draw_kicker(c, 72, HEIGHT - 140, "Roadmap")
    c.setFont(FONT_BOLD, 42)
    c.setFillColor(TEXT)
    c.drawString(72, HEIGHT - 205, "What's next.")

    # Three columns: Now, Next, Later
    col_labels = [
        ("NOW",      "Shipping this quarter", ACCENT),
        ("NEXT",     "Next 2 quarters",       Color(0.918, 0.345, 0.047, 0.6)),
        ("LATER",    "Vision",                Color(0.918, 0.345, 0.047, 0.35)),
    ]
    col_items = [
        [
            "Windows + Linux builds",
            "Visual backend editor (Supabase Studio-style)",
            "Auto-deploy sidebar (Vercel/Netlify)",
            "Chat-first UI redesign (Codex-style)",
        ],
        [
            "Real-time pair programming",
            "Cross-repo context library",
            "AI security review + adversarial tests",
            "Hardware interaction visualizer",
        ],
        [
            "Self-hosted / enterprise tier",
            "Mobile companion app",
            "Marketplace for community profiles",
            "Model training feedback loop",
        ],
    ]
    col_w = (WIDTH - 144) / 3
    for i, ((lbl, sub, col), items) in enumerate(zip(col_labels, col_items)):
        x = 72 + i * col_w
        # Kicker
        c.setFont(FONT_BOLD, 12)
        c.setFillColor(col)
        c.drawString(x, HEIGHT - 270, lbl)
        c.setFont(FONT_SANS, 11)
        c.setFillColor(TEXT_TERT)
        c.drawString(x, HEIGHT - 288, sub)
        # Items
        for j, item in enumerate(items):
            y = HEIGHT - 322 - j * 32
            c.setFillColor(col)
            c.setFont(FONT_BOLD, 12)
            c.drawString(x, y, "—")
            c.setFillColor(TEXT)
            c.setFont(FONT_SANS, 12)
            c.drawString(x + 18, y, item)

    draw_page_number(c, 10, 12)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 11: Team
# ═══════════════════════════════════════════════════════════════════
def slide_team(c):
    page_bg(c, seed=11)
    draw_logo_word(c, 48, HEIGHT - 56)

    draw_kicker(c, 72, HEIGHT - 140, "The team")
    c.setFont(FONT_BOLD, 42)
    c.setFillColor(TEXT)
    c.drawString(72, HEIGHT - 205, "Solo founder. Shipping fast.")

    # Big profile card
    card_x = 72
    card_y = HEIGHT - 440
    card_w = WIDTH - 144
    card_h = 220

    c.setFillColor(SURFACE)
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.6)
    c.roundRect(card_x, card_y, card_w, card_h, 14, stroke=1, fill=1)

    # Avatar placeholder (orange circle with initials)
    ax = card_x + 40
    ay = card_y + card_h - 72
    c.setFillColor(ACCENT)
    c.circle(ax + 24, ay + 20, 36, stroke=0, fill=1)
    c.setFillColor(BG)
    c.setFont(FONT_BOLD, 24)
    c.drawCentredString(ax + 24, ay + 12, "DW")

    # Name & role
    c.setFont(FONT_BOLD, 22)
    c.setFillColor(TEXT)
    c.drawString(card_x + 130, card_y + card_h - 50, "Dylan Wain")
    c.setFont(FONT_SANS, 14)
    c.setFillColor(ACCENT)
    c.drawString(card_x + 130, card_y + card_h - 75, "Founder & engineer")

    # Bio
    c.setFont(FONT_SANS, 12)
    c.setFillColor(TEXT_SEC)
    bio_lines = [
        "Built Tools AI from zero to signed production release in under 30 days.",
        "Full-stack: TypeScript extension, Next.js website, Stripe billing, Apple code-signing, Supabase auth.",
        "Operates the whole stack solo — product, engineering, design, customer support.",
    ]
    for i, line in enumerate(bio_lines):
        c.drawString(card_x + 130, card_y + card_h - 108 - i * 18, line)

    # Stack chips
    c.setFont(FONT_BOLD, 10)
    stack = ["TypeScript", "React", "Next.js", "Electron", "Supabase", "Stripe", "Three.js"]
    cx = card_x + 130
    cy = card_y + 40
    for s in stack:
        w = c.stringWidth(s, FONT_BOLD, 10) + 18
        c.setFillColor(Color(1, 1, 1, 0.06))
        c.setStrokeColor(BORDER_MED)
        c.setLineWidth(0.4)
        c.roundRect(cx, cy, w, 18, 9, stroke=1, fill=1)
        c.setFillColor(TEXT_SEC)
        c.drawString(cx + 9, cy + 5, s)
        cx += w + 6

    draw_page_number(c, 11, 12)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 12: Ask / Contact
# ═══════════════════════════════════════════════════════════════════
def slide_ask(c):
    page_bg(c, seed=12)
    draw_logo_word(c, 48, HEIGHT - 56)

    # Giant hero text
    c.setFont(FONT_BOLD, 64)
    c.setFillColor(TEXT)
    c.drawCentredString(WIDTH / 2, HEIGHT / 2 + 50, "Let's build this")
    c.setFillColor(ACCENT)
    c.drawCentredString(WIDTH / 2, HEIGHT / 2 - 10, "together.")

    # Subline
    c.setFont(FONT_SANS, 16)
    c.setFillColor(TEXT_SEC)
    c.drawCentredString(WIDTH / 2, HEIGHT / 2 - 60,
        "Seeking: pre-seed investment, design partners, early enterprise customers.")

    # Contact card
    card_w = 540
    card_h = 100
    card_x = (WIDTH - card_w) / 2
    card_y = HEIGHT / 2 - 200
    c.setFillColor(SURFACE)
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.6)
    c.roundRect(card_x, card_y, card_w, card_h, 14, stroke=1, fill=1)

    contacts = [
        ("Email",     "hello@thetoolswebsite.com"),
        ("Website",   "thetoolswebsite.com"),
        ("Download",  "github.com/DylanWain/Tools-AI-APP"),
    ]
    col_w = card_w / len(contacts)
    for i, (label, val) in enumerate(contacts):
        cx = card_x + i * col_w + col_w / 2
        c.setFont(FONT_BOLD, 10)
        c.setFillColor(ACCENT)
        c.drawCentredString(cx, card_y + card_h - 30, label.upper())
        c.setFont(FONT_SANS, 12)
        c.setFillColor(TEXT)
        c.drawCentredString(cx, card_y + card_h - 56, val)

    # Footer
    c.setFont(FONT_SANS, 10)
    c.setFillColor(TEXT_TERT)
    c.drawCentredString(WIDTH / 2, 44, "Tools AI · Made in California · 2026")


# ═══════════════════════════════════════════════════════════════════
# Build the deck
# ═══════════════════════════════════════════════════════════════════
def build():
    out = "/Users/dylanwain/Downloads/Tools-AI-repo/public/Tools-AI-Pitch-Deck.pdf"
    c = canvas.Canvas(out, pagesize=(WIDTH, HEIGHT))
    c.setTitle("Tools AI — Pitch Deck")
    c.setAuthor("Dylan Wain")
    c.setSubject("Tools AI investor / partner pitch deck")

    slides = [
        slide_cover, slide_problem, slide_solution, slide_how_it_works,
        slide_features, slide_differentiation, slide_market, slide_business,
        slide_traction, slide_roadmap, slide_team, slide_ask,
    ]
    for slide in slides:
        slide(c)
        c.showPage()

    c.save()
    print(f"Wrote {out}")


if __name__ == "__main__":
    build()
