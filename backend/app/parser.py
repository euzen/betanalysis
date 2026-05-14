from bs4 import BeautifulSoup
from datetime import datetime, date, timedelta
import re
from typing import Optional


def parse_datetime(day_text: str, time_text: str) -> Optional[datetime]:
    """Convert 'Dnes'/'Včera'/date + time to datetime."""
    today = date.today()
    if "dnes" in day_text.lower():
        d = today
    elif "včera" in day_text.lower():
        d = today - timedelta(days=1)
    else:
        # Try to parse a date like "12.4."
        m = re.search(r"(\d{1,2})\.(\d{1,2})\.", day_text)
        if m:
            day, month = int(m.group(1)), int(m.group(2))
            year = today.year
            d = date(year, month, day)
        else:
            d = today

    try:
        t = datetime.strptime(time_text.strip(), "%H:%M").time()
        return datetime.combine(d, t)
    except ValueError:
        return None


def parse_stake(text: str) -> Optional[float]:
    """Parse '10,00 Kč' -> 10.0"""
    text = text.replace("\xa0", "").replace("Kč", "").replace(",", ".").strip()
    try:
        return float(re.sub(r"[^\d.]", "", text))
    except ValueError:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Tipsport parser
# ─────────────────────────────────────────────────────────────────────────────

def parse_tipsport(soup: BeautifulSoup) -> dict:
    """Parse Tipsport HTML."""
    # Title: "NEVYHODNOCENÝ | SÓLO   | Dnes 11:54:19"
    title_el = soup.select_one("[data-atid='modalTitle'] .fucDiN, .ModalDialog-styled__ModalDialogTitleText-sc-6757418e-0")
    status = "NEVYHODNOCENÝ"
    ticket_type = "SÓLO"
    created_at = datetime.utcnow()
    bookmaker = "Tipsport"

    STATUS_MAP = {
        "VYHRÁVAJÍCÍ": "VÝHERNÍ",
        "PROHRÁVAJÍCÍ": "PROHRÁVAJÍCÍ",
        "NEVYHODNOCENÝ": "NEVYHODNOCENÝ",
        "VÝHERNÍ": "VÝHERNÍ",
        "STORNOVANÝ": "STORNOVANÝ",
    }

    if title_el:
        title_text = title_el.get_text(" ", strip=True)
        parts = [p.strip() for p in title_text.split("|")]
        if len(parts) >= 1:
            raw_status = parts[0].strip()
            status = STATUS_MAP.get(raw_status, raw_status)
        if len(parts) >= 2:
            ticket_type = parts[1].strip()
        for part in parts[2:]:
            dt_parts = part.strip().split()
            if len(dt_parts) >= 2:
                day_part = dt_parts[0]
                time_part = dt_parts[1]
                if "dnes" in day_part.lower() or "včera" in day_part.lower() or re.match(r"\d", day_part):
                    today = date.today()
                    if "dnes" in day_part.lower():
                        d = today
                    elif "včera" in day_part.lower():
                        d = today - timedelta(days=1)
                    else:
                        d = today
                    try:
                        t = datetime.strptime(time_part, "%H:%M:%S").time()
                        created_at = datetime.combine(d, t)
                        break
                    except ValueError:
                        pass

    # Summary
    total_odds = None
    stake = None
    possible_win = None
    actual_win = None

    summary_rows = soup.select(".dPJUej")
    for row in summary_rows:
        label = row.get_text(" ", strip=True).lower()
        strong = row.find("strong")
        if not strong:
            continue
        value_text = strong.get_text(strip=True)
        if "celkový kurz" in label:
            try:
                total_odds = float(value_text.replace(",", "."))
            except ValueError:
                pass
        elif "vklad" in label:
            stake = parse_stake(value_text)
        elif "možná výhra" in label or "skutečná výhra" in label:
            v = parse_stake(value_text)
            if "možná" in label:
                possible_win = v
            else:
                actual_win = v

    # Bets
    bets = []
    bet_blocks = soup.select("[data-atid='ticketDetailBet']")

    for block in bet_blocks:
        time_items = block.select(".jjDAIC .whiteSpace-noWrap")
        match_dt = None
        if len(time_items) >= 2:
            match_dt = parse_datetime(time_items[0].get_text(strip=True), time_items[1].get_text(strip=True))

        league_el = block.select_one(".fsRcBe")
        league = league_el.get_text(strip=True) if league_el else None

        match_link = block.select_one("[data-atid='matchReferenceLink']")
        match_name = match_link.get_text(strip=True) if match_link else "Neznámý zápas"

        tip = None
        odds = None
        eGMWco = block.find_next_sibling(class_=re.compile("eGMWco"))
        if eGMWco:
            tip_div = eGMWco.select_one(".clr-SET_PRIMARY")
            if tip_div:
                tip_text = tip_div.get_text(strip=True)
                strong_in_tip = tip_div.find("strong")
                tip = strong_in_tip.get_text(strip=True) if strong_in_tip else tip_text
            odds_el = eGMWco.select_one(".font-SingleM_12")
            if odds_el:
                try:
                    odds = float(odds_el.get_text(strip=True).replace(",", "."))
                except ValueError:
                    pass

        result = "NEVYHODNOCENO"
        icon_div = block.select_one(".t-printTicket__iconList")
        if icon_div:
            use_el = icon_div.find("use")
            if use_el:
                href = use_el.get("xlink:href", "")
                if "i173" in href:
                    result = "PROHRA"
                elif "i172" in href:
                    result = "NEVYHODNOCENO"
                elif "i170" in href or "i171" in href or "i175" in href:
                    result = "VÝHRA"

        score_el = block.find_next(class_=re.compile("MiniLabel-styled__Badge"))
        score = score_el.get_text(strip=True) if score_el else None

        if match_name and odds:
            bets.append({
                "match_name": match_name,
                "league": league,
                "match_datetime": match_dt,
                "tip": tip or "",
                "odds": odds,
                "result": result,
                "score": score,
            })

    return {
        "bookmaker": bookmaker,
        "status": status,
        "ticket_type": ticket_type,
        "created_at": created_at,
        "total_odds": total_odds,
        "stake": stake,
        "possible_win": possible_win,
        "actual_win": actual_win,
        "bets": bets,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Fortuna parser
# ─────────────────────────────────────────────────────────────────────────────

def parse_fortuna(soup: BeautifulSoup) -> dict:
    """Parse Fortuna HTML."""
    status = "NEVYHODNOCENÝ"
    ticket_type = "SÓLO"
    created_at = datetime.utcnow()
    bookmaker = "Fortuna"

    # Status from result badge
    result_badge = soup.select_one(".betslip-result--winning, .betslip-result--losing, .betslip-result--lost")
    if result_badge:
        text = result_badge.get_text(strip=True).lower()
        if "výherní" in text:
            status = "VÝHERNÍ"
        elif "prohran" in text or "prohrá" in text:
            status = "PROHRÁVAJÍCÍ"

    # Ticket type from title "Tiket Solo"
    title_el = soup.select_one(".leading-6.font-bold")
    if title_el:
        title_text = title_el.get_text(strip=True).lower()
        if "solo" in title_text:
            ticket_type = "SÓLO"
        elif "aku" in title_text:
            ticket_type = "AKU"

    # Summary: Celkový kurz, Celková sázka, Skutečná výhra
    total_odds = None
    stake = None
    possible_win = None
    actual_win = None

    summary_section = soup.select_one(".betslip-dates-money")
    if summary_section:
        # Try .winning class first, then any flex row
        rows = summary_section.select(".winning")
        if not rows:
            rows = summary_section.select("div.flex, div.f-flex")
        for row in rows:
            # Find label span
            spans = row.find_all("span")
            if not spans:
                continue
            label = spans[0].get_text(strip=True).lower()
            # Find value in text-content-primary or font-bold
            value_span = row.select_one("span.text-content-primary.font-bold, span.text-content-primary, .f-font-bold")
            if not value_span:
                continue
            value_text = value_span.get_text(strip=True)

            if "kurz" in label:
                try:
                    total_odds = float(value_text.replace(",", "."))
                except ValueError:
                    pass
            elif "sázka" in label or "vklad" in label:
                stake = parse_stake(value_text)
            elif "výhra" in label:
                actual_win = parse_stake(value_text)

    # Bets - betslip-leg blocks
    bets = []
    bet_blocks = soup.select(".betslip-leg")

    for block in bet_blocks:
        # Match name - try data-tooltip first, then title, then text content
        match_name = "Neznámý zápas"
        match_el = block.select_one("h3[data-tooltip], h3[title]")
        if match_el:
            match_name = match_el.get("data-tooltip") or match_el.get("title") or match_el.get_text(strip=True)
        else:
            match_el = block.select_one("h3, .f-text-md.f-font-bold")
            if match_el:
                match_name = match_el.get_text(strip=True)
        match_name = match_name.replace("\n", " ").strip()

        # Date/time - "pá 1. 5. 2026 17:00"
        date_el = block.select_one(".betslip-leg-date span, .f-line-clamp-1")
        match_dt = None
        if date_el:
            date_text = date_el.get_text(strip=True)
            # Parse "pá 1. 5. 2026 17:00" format
            m = re.search(r'(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+(\d{1,2}):(\d{2})', date_text)
            if m:
                day, month, year, hour, minute = map(int, m.groups())
                try:
                    match_dt = datetime(year, month, day, hour, minute)
                except ValueError:
                    pass

        # League - "Fotbal / 2. Slovensko" - look for pattern after odds
        league = None
        # Try to find league in specific element
        league_el = block.select_one(".f-leading-tight + div, .f-mt-1")
        if league_el:
            league_text = league_el.get_text(strip=True)
            if "/" in league_text and ("Fotbal" in league_text or "Hokej" in league_text or "Tenis" in league_text or "Basket" in league_text or league_text.count(".") >= 1):
                league = league_text
        # Fallback: look for any element with slash and sport name
        if not league:
            for el in block.select(".f-text-xs, div"):
                text = el.get_text(strip=True)
                if "/" in text and len(text) < 50:
                    league = text
                    break

        # Tip - "Počet gólů v zápasu 1.5: + 1.5"
        # Look for div with data-selection-id which contains the bet tip
        tip = ""
        tip_el = block.select_one("div[data-selection-id]")
        if tip_el:
            tip = tip_el.get_text(strip=True)
        else:
            # Fallback to other selectors
            tip_el = block.select_one(".f-line-clamp-2:not(h3)")
            if tip_el:
                tip = tip_el.get_text(strip=True)

        # Odds - look for the odds value near the tip
        odds = None
        # Try multiple selectors for odds
        odds_selectors = [
            ".f-text-content-primary.f-font-bold",
            ".f-text-content-primary.f-ml-4 .f-font-bold",
            ".f-font-bold.f-rounded-sm",
            "[class*='f-font-bold']",
        ]
        for selector in odds_selectors:
            odds_el = block.select_one(selector)
            if odds_el:
                try:
                    text = odds_el.get_text(strip=True).replace(",", ".")
                    val = float(text)
                    if 1.0 < val < 1000:  # reasonable odds range
                        odds = val
                        break
                except ValueError:
                    continue

        # Result icon - cic_ticket-win = win, cic_ticket-loss = loss
        result = "NEVYHODNOCENO"
        icon_use = block.select_one(".betslip-leg__actions use")
        if icon_use:
            href = icon_use.get("href", "")
            if "ticket-win" in href or "win" in href.lower():
                result = "VÝHRA"
            elif "ticket-loss" in href or "loss" in href.lower():
                result = "PROHRA"
        # If ticket status is known, infer individual bet results
        if status == "VÝHERNÍ":
            result = "VÝHRA"
        elif status == "PROHRÁVAJÍCÍ":
            result = "PROHRA"

        # Score badge
        score = None
        score_el = block.select_one(".betslip-leg__badge")
        if score_el:
            score = score_el.get_text(strip=True)

        if match_name and odds:
            bets.append({
                "match_name": match_name,
                "league": league,
                "match_datetime": match_dt,
                "tip": tip,
                "odds": odds,
                "result": result,
                "score": score,
            })

    return {
        "bookmaker": bookmaker,
        "status": status,
        "ticket_type": ticket_type,
        "created_at": created_at,
        "total_odds": total_odds,
        "stake": stake,
        "possible_win": possible_win,
        "actual_win": actual_win,
        "bets": bets,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main parser entry point
# ─────────────────────────────────────────────────────────────────────────────

def parse_ticket_html(html: str) -> dict:
    """
    Parse ticket HTML from Tipsport or Fortuna.
    Returns dict with ticket + bets data.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Detect bookmaker by unique HTML elements
    # Fortuna has betslip-history-detail or betslip-leg classes
    if soup.select_one(".betslip-history-detail, .betslip-leg, .betslip-header"):
        return parse_fortuna(soup)

    # Tipsport has data-atid='modalTitle'
    if soup.select_one("[data-atid='modalTitle']"):
        return parse_tipsport(soup)

    # Default fallback - try Tipsport parser
    return parse_tipsport(soup)
