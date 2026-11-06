import os

i = 0

for item in os.listdir(os.path.dirname(os.path.realpath(__file__))):
    
    if(item.endswith('.jpeg')):
        os.rename(item, str(i)+'.jpeg')
        i = i + 1