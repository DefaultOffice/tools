DEPLOYMENT PROMPT — Paste at the end of any tool-building chat:

---

This tool needs to be prepared for deployment to tools.defaultoffice.com.

Ask me the following before proceeding:

1. What should this tool be called? (display name for the index)
2. What category does it fall under? (Pattern / Animation / Environment / Utility / Simulation / Generator / or suggest one)
3. Which project or client is this for? (or "General" if internal)
4. Who built it? (Alex, Joe, or Jake)
5. What should the folder name be? (short lowercase hyphenated name for the URL, e.g. "wave-mesh" — or suggest one for me to approve)

Once you have my answers, do the following:

1. Package the tool as a single self-contained index.html (all HTML/CSS/JS in one file, CDN deps only, include a small "← Back" link to "/" in the top-left)
2. Create a meta.json with this format:
   {
       "name": "Tool Display Name",
       "category": "Category",
       "project": "Project",
       "owner": "Owner",
       "date": "DD.MM.YYYY"
   }
3. Generate a downloadable zip named [folder-name].zip containing:
   - [folder-name]/index.html
   - [folder-name]/meta.json
   - [folder-name]/thumbnail.png (placeholder — remind me to replace with a real 16:9 screenshot)
4. Remind me: unzip into /tools/, push to GitHub, done — it auto-deploys
