import { schema, table, t } from "spacetimedb/server";

const videos = table(
  { public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    title: t.string(),
    url: t.string(),
    format: t.string(),     // "mp4" or "hls"
    isLive: t.bool(),
    createdAt: t.u64(),
  }
);

const spacetimedb = schema({ videos });
export default spacetimedb;

export const addVideo = spacetimedb.reducer(
  {
    title: t.string(),
    url: t.string(),
    format: t.string(),
    createdAt: t.u64(),
  },
  (ctx, { title, url, format, createdAt }) => {
    ctx.db.videos.insert({
      id: 0n,
      title,
      url,
      format,
      isLive: false,
      createdAt,
    });
  }
);

export const startLive = spacetimedb.reducer(
  { id: t.u64() },
  (ctx, { id }) => {
    const video = ctx.db.videos.id.find(id);
    if (!video) throw new Error("Video not found");
    video.isLive = true;
    ctx.db.videos.id.update(video);
  }
);

export const stopLive = spacetimedb.reducer(
  { id: t.u64() },
  (ctx, { id }) => {
    const video = ctx.db.videos.id.find(id);
    if (!video) throw new Error("Video not found");
    video.isLive = false;
    ctx.db.videos.id.update(video);
  }
);