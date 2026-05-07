import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

url = "https://artofproblemsolving.com/community/c3223_imo_shortlist"

options = Options()
options.add_argument("--headless=new")

driver = webdriver.Chrome(options=options)
driver.get(url)

driver.implicitly_wait(5)

cards = driver.find_elements(By.CSS_SELECTOR, "a.cmty-full-cell-link")

results = []

for card in cards:
    href = card.get_attribute("href")
    if href:
        results.append(href)

print(results[:20])

driver.quit()