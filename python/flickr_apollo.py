import math
import sys
import time
import urllib.parse

import requests
import parsel
from urllib.parse import urlencode
from urllib3.exceptions import InsecureRequestWarning

requests.urllib3.disable_warnings(InsecureRequestWarning)

# 代理设置
proxies = {
'http': 'http://127.0.0.1:7890',
'https': 'http://127.0.0.1:7890'
}

api_key = 'd2d096ce6974c875c3e13e695660e085'
total_count_url = 'https://api.flickr.com/services/rest?path_alias=projectapolloarchive&method=flickr.people.getInfo&api_key={}&format=json&nojsoncallback=1'
service_url = 'https://api.flickr.com/services/rest?per_page={}&page={}&user_id=136485307%40N06&sort=use_pref&method=flickr.people.getPhotos&api_key={}&format=json&nojsoncallback=1'
photo_url = 'https://www.flickr.com/photos/projectapolloarchive/{}/sizes/o/'
total_page = 1
max_page_size = 500

all_photos = []

try:
    with requests.get(str.format(total_count_url, api_key), timeout=300, verify=False, proxies=proxies) as resp:
        total_count = resp.json()['person']['photos']['count']['_content']
except Exception as exl:
    print('获取总数出错')
    raise(exl)

total_page = math.ceil(int(total_count)/max_page_size)

def getPage(pageNo):
    try:
        time.sleep(1)
        with requests.get(str.format(service_url, max_page_size, pageNo, api_key), timeout=300, verify=False, proxies=proxies) as resp:
            #print(resp.text)
            return resp.json()
    except Exception as exl:
        print('第 '+str(pageNo)+' 页出错')
        raise(exl)

def getDocument(photo_id):
    try:
        time.sleep(1)
        with requests.get(str.format(photo_url, photo_id), timeout=300, verify=False, proxies=proxies) as resp:
            #print(resp.text)
            return parsel.Selector(resp.text)
    except Exception as exl:
        print('图片 '+str(photo_id)+' 出错')
        raise(exl)

def getDownloadUrl(photos):
    for i in range(0, len(photos)):
        photo_id = photos[i]['id']
        document = getDocument(photo_id)
        dl_url = document.css('#all-sizes-header > dl:nth-child(2) > dd > a::attr(href)').extract()
        photos[i]['dl_url'] = dl_url[0]

def main():
    for i in range(1, total_page + 1):
        print('第 '+str(i)+'/'+str(total_page)+' 页')
        json = getPage(i)
        photos = json['photos']['photo']
        getDownloadUrl(photos)
        for i in range(0, len(photos)):
            photo = photos[i]
            #all_photos.append(str(photo))
            #只要下载链接
            all_photos.append(photo['dl_url'])
    print('抓取完成，共计 '+str(len(all_photos))+' 条')
    with open('all_photos_apollo.txt', 'w+', encoding='utf-8') as file:
        file.write('\n'.join(all_photos))

main()
