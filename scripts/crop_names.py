from PIL import Image

img = Image.open(r'C:\Users\hh346\.gemini\antigravity-ide\brain\3ff2b650-ac01-452f-be8f-e90c7c0ddd81\.user_uploaded\media_1789272698299.png')
print('Size:', img.size)

# The 'name' column is Column C.
# Let's crop the Name column (Column C) and save as artifact to view
# Looking at the table, columns from right to left:
# A: חודש חיוב (~900 to 1000)
# B: תאריך חיוב (~780 to 900)
# C: שם (~640 to 780)
# D: כתובת מייל (~390 to 640)
# E: טלפון (~250 to 390)
# F: שולם (~130 to 250)
# G: אסמכתא (0 to 130)

w, h = img.size
name_col = img.crop((int(w * 0.62), 0, int(w * 0.80), h))
name_col.save(r'C:\Users\hh346\.gemini\antigravity-ide\brain\3ff2b650-ac01-452f-be8f-e90c7c0ddd81\name_column.png')
print('Saved name_column.png')
