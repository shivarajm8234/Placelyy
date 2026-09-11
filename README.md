# Placelyy

Spark-free placement library: **Auth + Realtime Database + Hosting**.

## Access

| Action | Who |
| --- | --- |
| View / open PDFs | Any signed-in Google user |
| Upload, move folder, delete | Only `shivarajmani2005@gmail.com` |

## Library workspace (`/library`)

- Folder sidebar (AI, CN, DBMS, DS, OS, SD, Notes, …)
- Open up to **3 documents** at once
- Drag the divider to **resize** panes
- PDFs: first **2–3 pages** load first (preview), then the full file

## Deploy

```bash
npm run deploy
```

Deploys Hosting + Realtime Database rules (admin write locked to your email).
