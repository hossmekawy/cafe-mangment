import re

with open('/root/cafe-mangment/frontend/src/pages/pos/POSDashboard.jsx', 'r') as f:
    content = f.read()

# Remove zoom
content = content.replace('style={{ zoom: "0.8" }}', '')

# Apply layout reductions
replacements = [
    # Top bar padding and sizes
    (r'className="p-6 pb-0', r'className="p-4 pb-0'),
    (r'mb-6"', r'mb-4"'),
    (r'text-3xl', r'text-2xl'),
    (r'py-3 pl-12', r'py-2 pl-10'),
    
    # Categories
    (r'px-6 py-3 rounded-full', r'px-4 py-2 text-sm rounded-full'),
    
    # Grid area
    (r'className="flex-1 p-6', r'className="flex-1 p-4'),
    (r'gap-4 content-start', r'gap-3 content-start'),
    (r'rounded-2xl p-4', r'rounded-xl p-3'),
    (r'h-40"', r'h-32"'),
    (r'w-14 h-14', r'w-10 h-10'),
    (r'w-12 h-12', r'w-10 h-10'),
    (r'mb-3', r'mb-2'),
    
    # Cart panel
    (r'w-96 bg-background', r'w-80 2xl:w-96 bg-background'),
    (r'p-6 border-b', r'p-4 border-b'),
    (r'text-xl font-black text-textMain', r'text-lg font-black text-textMain'),
    (r'px-6 py-3', r'px-4 py-2.5'),
    (r'px-6 py-4', r'px-4 py-3'),
    
    # Cart items
    (r'p-4 custom-scrollbar space-y-3', r'p-3 custom-scrollbar space-y-2'),
    (r'rounded-xl p-3 flex', r'rounded-lg p-2.5 flex'),
    
    # Cart Footer
    (r'border-t (.*?) p-6', r'border-t \1 p-4'),
    (r'space-y-2 mb-4 text-sm', r'space-y-1 mb-3 text-sm'),
    (r'text-xl pt-2', r'text-lg pt-1.5'),
    
    # Bottom checkout buttons
    (r'py-3 rounded-xl', r'py-2.5 rounded-lg'),
    (r'text-lg py-3 rounded-xl', r'text-base py-2.5 rounded-lg'),
]

for old, new in replacements:
    content = re.sub(old, new, content)

with open('/root/cafe-mangment/frontend/src/pages/pos/POSDashboard.jsx', 'w') as f:
    f.write(content)

print("Done")
