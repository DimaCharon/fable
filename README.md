# Fable — Dark Fairytale Social Network

Mobile-first multi-page social web app with dark frosted glass UI, magical accents (emerald / amethyst / amber), Firestore realtime data, and **ImgBB** image hosting (no Firebase Storage).

## Files

| File | Role |
|------|------|
| `index.html` | Nickname login (LocalStorage) |
| `feed.html` | Global realtime feed |
| `profile.html` | Profile, posts grid, game event notifications |
| `games.html` | Games hub · Publication · mini-games · Masters & Slaves |
| `style.css` | Fable dark-fairytale styles |
| `script.js` | Auth, Firestore, ImgBB uploads, social economy |
| `games.js` | Canvas mini-games (Gates, Castle, Pin, Weapon) |

## 1. Firebase (Firestore only)

1. Open **`script.js`** → `firebaseConfig` at the top.
2. Firebase Console → ⚙ Project settings → Your apps → Web → paste keys.
3. Enable **Firestore** (test mode OK for demos).
4. **Do not enable Storage** — images use ImgBB.

### ImgBB (images)

```js
const IMGBB_API_KEY = "daa0c00d6ef8246d2d3ba58d19f83ce0";
```

Posts with photos: file → `POST https://api.imgbb.com/1/upload` → save `display_url` into Firestore `posts.imageUrl`.

### Demo Firestore rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{id} {
      allow read: if true;
      allow create, update: if true;
      allow delete: if false;
    }
    match /players/{id} {
      allow read, write: if true;
    }
    match /gameEvents/{id} {
      allow read, write: if true;
    }
  }
}
```

## 2. Run locally

```bash
cd neon-social
python -m http.server 8080
# http://localhost:8080
```

## 3. Features

- **Auth** — nickname → `localStorage`
- **Feed** — Firestore realtime; images via ImgBB URLs
- **Profile** — stats, grid, realm events
- **Nav** — Profile · Games · + Create · Feed
- **Games page**
  - Masters & Slaves (Firestore economy)
  - **Publication** section (middle of list) → create post / open feed
  - Dual-color gradient section transitions
  - Playable canvas games: Multiplier Gates, Hero Castle Wars, Pull the Pin, Weapon Evolution

## 4. Collections

| Collection | Purpose |
|------------|---------|
| `posts` | Feed (`imageUrl` = ImgBB link) |
| `players` | Masters & Slaves economy |
| `gameEvents` | Profile notifications |
