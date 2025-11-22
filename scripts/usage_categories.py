import json
import sqlite3
from collections import defaultdict

DB = "../2025-10-20-trimmed.sqlite"


def get_yearly_percentages(db_path: str):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    query = """
    WITH YearlyPct AS (
        SELECT
            y.term_id,
            y.attr,
            strftime('%Y', y.day, 'unixepoch') AS year,
            COALESCE((y.hits * 1.0) / t.hits, 0) AS hits_pct,
            COALESCE((y.authors * 1.0) / t.authors, 0) AS authors_pct
        FROM 
            yearly y
            LEFT JOIN total_yearly t ON y.day = t.day
        WHERE 
            t.term_len = 1 AND
            t.attr = 0 AND 
            y.day > 1450000000
    )
    SELECT 
        t.text,
        yp.year,
        yp.hits_pct,
        yp.authors_pct
    FROM 
        YearlyPct yp
        JOIN term t ON yp.term_id = t.id
    WHERE 
        t.len = 1 AND
        yp.attr = 0
    ;
    """

    cursor.execute(query)
    results = cursor.fetchall()
    conn.close()

    term_data = defaultdict(lambda: defaultdict(float))
    for text, year, hits_pct, authors_pct in results:
        term_data[text][year] = authors_pct

    print(json.dumps(term_data, indent=2, sort_keys=True, ensure_ascii=False))
    return term_data


def filter_consecutive_years(term_data, min_percent=0.05, min_consecutive=3):
    valid_terms = []
    for term, years_dict in term_data.items():
        years = sorted(years_dict.keys())
        percentages = [years_dict[year] for year in years]

        count = 0
        min_streak_pct = float("inf")
        max_streak_pct = float("-inf")

        for i in range(len(years)):
            if percentages[i] >= min_percent:
                count += 1
                min_streak_pct = min(min_streak_pct, percentages[i])
                max_streak_pct = max(max_streak_pct, percentages[i])

                if count >= min_consecutive:
                    valid_terms.append((term, min_streak_pct, max_streak_pct))
                    break
            else:
                count = 0
                min_streak_pct = float("inf")
                max_streak_pct = float("-inf")

    return sorted(valid_terms, key=lambda x: x[1], reverse=True)


if __name__ == "__main__":
    term_data = get_yearly_percentages(DB)

    filters = [
        (0.10, 5),  # >=10% authorship over 5 years
        # (0.10, 4),
        # (0.10, 3),
        # (0.07, 5),
        # (0.07, 4),
        (0.075, 4),  # >= 7.5% authorship over 3 years
        # (0.05, 5),
        # (0.05, 4),
        (0.05, 3),  # >= 5% authorship over 3 years
        # (0.03, 3),
    ]

    seen = set()

    for min_pct, years in filters:
        terms = filter_consecutive_years(term_data, min_pct, years)

        # ignore terms found in prior filters
        new_terms = [
            (term, term_min_pct, term_max_pct)
            for term, term_min_pct, term_max_pct in terms
            if term not in seen
        ]

        seen.update(term for term, _, _ in new_terms)

        if new_terms:
            filename = f"terms_{min_pct}_{years}.txt"
            with open(filename, "w") as f:
                for term, term_min_pct, term_max_pct in new_terms:
                    f.write(f"{term}: {term_min_pct:.2%} - {term_max_pct:.2%}\n")
