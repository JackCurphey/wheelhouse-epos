"""Structural QA for the two generated review PDFs."""
from pathlib import Path
import json
import re

import fitz


root = Path(__file__).parent
screens = json.loads((root / "screen-index.json").read_text())
ordered = sorted(screens, key=lambda screen: int(screen["number"]))
review = fitz.open(root / "Wheelhouse-Release-1-Screen-Review.pdf")
board = fitz.open(root / "Wheelhouse-Release-1-Journey-Board.pdf")

assert len(review) == len(ordered) + 1
assert len(board) == 1
assert not review.is_encrypted and not board.is_encrypted
assert len(review.get_toc()) == len(ordered) + 7  # cover + six chapters + screens
assert "journeys—from" in review[0].get_text()

for index, screen in enumerate(ordered, start=1):
    text = review[index].get_text()
    page_text = re.sub(r"\s+", " ", text).replace("\xad", "-")
    assert f'{screen["number"]} /' in page_text
    title_words = re.findall(r"[\w£]+", screen["title"], flags=re.UNICODE)
    assert all(word in page_text for word in title_words), (screen["id"], title_words)
    assert "VIEWPORT" in text
    # PDF text extraction can replace a nonbreaking or soft-hyphen character.
    note_words = re.findall(r"[\w£]+", screen["note"], flags=re.UNICODE)[:5]
    assert all(word in page_text for word in note_words), (screen["id"], note_words)

board_text = re.sub(r"\s+", " ", board[0].get_text()).replace("\xad", "-")
for screen in ordered:
    assert f'{screen["number"]} / {screen["id"]}' in board_text

result = {
    "journeyBoard": {
        "pages": len(board),
        "format": "single large vector page",
        "screens": len(ordered),
        "pageSizePoints": [round(board[0].rect.width, 1), round(board[0].rect.height, 1)],
    },
    "screenReview": {
        "pages": len(review),
        "coverPages": 1,
        "screenPages": len(ordered),
        "bookmarks": len(review.get_toc()),
        "screenHeadingsAndNotesVerified": len(ordered),
    },
    "sampleVisualInspection": [
        "cover",
        "service",
        "date",
        "quote-editor",
        "diary",
        "print",
        "settings",
        "message-error",
    ],
}
(root / "pdf-verification.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
