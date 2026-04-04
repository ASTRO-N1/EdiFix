import requests
# CMS publishes MA-prefix RARCs separately
url = 'https://www.cms.gov/files/zip/remittance-advice-remark-codes-rcs.zip'
print('Checking CMS RARC ZIP...')
r = requests.head(url, timeout=10)
print('Status:', r.status_code)
print('Content-Type:', r.headers.get('Content-Type'))