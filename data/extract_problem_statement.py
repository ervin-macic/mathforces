import requests
from bs4 import BeautifulSoup, NavigableString, Tag

url = "https://artofproblemsolving.com/community/c6h3107339p28104298?print=true"
response = requests.get(url)
soup = BeautifulSoup(response.text, "html.parser")

# Find all problem post divs
post_divs = soup.find_all("div", class_="cmty-post-html")

def extract_text_with_latex(element):
    """
    Recursively extract text from a BeautifulSoup element.
    Replace <img class="latex"> with its alt attribute (LaTeX code).
    """
    parts = []
    for child in element.children:
        if isinstance(child, NavigableString):
            parts.append(str(child))
        elif isinstance(child, Tag):
            if child.name == "img" and "latex" in child.get("class", []):
                parts.append(child.get("alt", ""))  # Use LaTeX code
            else:
                parts.append(extract_text_with_latex(child))
    return "".join(parts)

# Combine all posts into one string
problem_text = "\n\n".join(extract_text_with_latex(div) for div in post_divs)

print(problem_text)
