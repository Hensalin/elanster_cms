// Central CMS database. Every piece of website content carries a websiteId and the
// backend always filters by it, so one site can never see another site's content.
import { relations, sql } from "drizzle-orm";
import {
  pgTable, pgEnum, text, boolean, integer, timestamp, jsonb, primaryKey,
  uniqueIndex, index, customType,
} from "drizzle-orm/pg-core";
import { createId } from "@/lib/id";

export const roleEnum = pgEnum("role", ["SUPER_ADMIN", "WEBSITE_ADMIN", "EDITOR"]);
export const statusEnum = pgEnum("content_status", [
  "DRAFT", "IN_REVIEW", "SCHEDULED", "PUBLISHED", "UNPUBLISHED",
]);

const id = () => text("id").primaryKey().$defaultFn(createId);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());
const deletedAt = () => timestamp("deleted_at", { withTimezone: true });

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("EDITOR"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(), updatedAt: updatedAt(), deletedAt: deletedAt(),
});

export const websites = pgTable("websites", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // short key, e.g. "elanster"
  domain: text("domain").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(), updatedAt: updatedAt(), deletedAt: deletedAt(),
});

// Which users may manage which website, and with what role there.
export const websiteUsers = pgTable("website_users", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  websiteId: text("website_id").notNull().references(() => websites.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull().default("EDITOR"),
}, (t) => [primaryKey({ columns: [t.userId, t.websiteId] })]);

export const categories = pgTable("blog_categories", {
  id: id(),
  websiteId: text("website_id").notNull().references(() => websites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  color: text("color").notNull().default(""),
}, (t) => [uniqueIndex("categories_site_slug").on(t.websiteId, t.slug)]);

export const tags = pgTable("blog_tags", {
  id: id(),
  websiteId: text("website_id").notNull().references(() => websites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
}, (t) => [uniqueIndex("tags_site_slug").on(t.websiteId, t.slug)]);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const media = pgTable("media", {
  id: id(),
  websiteId: text("website_id").notNull().references(() => websites.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),       // name of the stored file
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  width: integer("width"), height: integer("height"),
  altText: text("alt_text").notNull().default(""),
  folder: text("folder").notNull().default(""),
  data: bytea("data"),                         // the image itself (stored in the database so it works on Vercel)
  createdAt: createdAt(), deletedAt: deletedAt(),
});

const seoColumns = () => ({
  seoTitle: text("seo_title").notNull().default(""),
  metaDescription: text("meta_description").notNull().default(""),
  canonicalUrl: text("canonical_url").notNull().default(""),
  robots: text("robots").notNull().default("index,follow"),
  ogTitle: text("og_title").notNull().default(""),
  ogDescription: text("og_description").notNull().default(""),
  ogImageId: text("og_image_id").references(() => media.id, { onDelete: "set null" }),
});

export const blogs = pgTable("blogs", {
  id: id(),
  websiteId: text("website_id").notNull().references(() => websites.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  excerpt: text("excerpt").notNull().default(""),
  content: text("content").notNull().default(""), // sanitized HTML
  status: statusEnum("status").notNull().default("DRAFT"),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull().default(""), // name shown on the website; empty = the author's account name
  // Suggested changes to a live article (an editor's copy). The live article stays as it is until an admin approves.
  pending: text("pending"),                                     // JSON of the edited fields, or null
  pendingState: text("pending_state").notNull().default(""),   // "" (being edited), "WAITING" (sent for review), "CHANGES" (sent back)
  pendingBy: text("pending_by").references(() => users.id, { onDelete: "set null" }),
  pendingAt: timestamp("pending_at", { withTimezone: true }),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  featuredImageId: text("featured_image_id").references(() => media.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  reviewNote: text("review_note").notNull().default(""), // why an admin sent it back
  ...seoColumns(),
  createdAt: createdAt(), updatedAt: updatedAt(), deletedAt: deletedAt(),
}, (t) => [
  uniqueIndex("blogs_site_slug").on(t.websiteId, t.slug),
  index("blogs_site_status").on(t.websiteId, t.status),
]);

export const blogTags = pgTable("blog_tag_links", {
  blogId: text("blog_id").notNull().references(() => blogs.id, { onDelete: "cascade" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.blogId, t.tagId] })]);

export const pages = pgTable("pages", {
  id: id(),
  websiteId: text("website_id").notNull().references(() => websites.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull().default(""),
  content: text("content").notNull().default(""),
  status: statusEnum("status").notNull().default("DRAFT"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  // Review of the unpublished changes: "" (none), "WAITING" (an editor sent them), "CHANGES" (an admin sent them back).
  reviewState: text("review_state").notNull().default(""),
  reviewNote: text("review_note").notNull().default(""),
  reviewBy: text("review_by").references(() => users.id, { onDelete: "set null" }),
  reviewAt: timestamp("review_at", { withTimezone: true }),
  editedBy: text("edited_by").references(() => users.id, { onDelete: "set null" }), // last person who saved a draft
  ...seoColumns(),
  createdAt: createdAt(), updatedAt: updatedAt(), deletedAt: deletedAt(),
}, (t) => [uniqueIndex("pages_site_slug").on(t.websiteId, t.slug)]);

// A block of a page (hero, FAQ, CTA ...). `type` decides which fields exist; the values
// live in `data` (JSON) so every website can keep its own layout.
export const pageSections = pgTable("page_sections", {
  id: id(),
  pageId: text("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  position: integer("position").notNull().default(0),
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
  visible: boolean("visible").notNull().default(true),
}, (t) => [index("sections_page_pos").on(t.pageId, t.position)]);

// Every publish / unpublish / schedule action, for audit.
export const publishingHistory = pgTable("publishing_history", {
  id: id(),
  blogId: text("blog_id").references(() => blogs.id, { onDelete: "cascade" }),
  pageId: text("page_id").references(() => pages.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(), // PUBLISH | UNPUBLISH | SCHEDULE | UPDATE | SUBMIT_REVIEW
  note: text("note").notNull().default(""),
  createdAt: createdAt(),
});

export const activityLogs = pgTable("activity_logs", {
  id: id(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  websiteId: text("website_id").references(() => websites.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entity: text("entity").notNull().default(""),
  entityId: text("entity_id").notNull().default(""),
  summary: text("summary").notNull().default(""),
  createdAt: createdAt(),
}, (t) => [index("activity_created").on(t.createdAt)]);

// Saved copies of articles and pages, so an older version can be restored.
export const versions = pgTable("content_versions", {
  id: id(),
  entity: text("entity").notNull(), // blog | page
  entityId: text("entity_id").notNull(),
  websiteId: text("website_id").references(() => websites.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  data: jsonb("data").notNull(),
  createdAt: createdAt(),
}, (t) => [index("versions_entity").on(t.entity, t.entityId, t.createdAt)]);

// Login / sign-up / contact-form attempt counters (kept in the database so they survive redeploys).
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

// One key per website connection. Only the SHA-256 hash is stored, never the key itself.
export const apiKeys = pgTable("api_keys", {
  id: id(),
  websiteId: text("website_id").notNull().references(() => websites.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  active: boolean("active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const blogRelations = relations(blogs, ({ one, many }) => ({
  website: one(websites, { fields: [blogs.websiteId], references: [websites.id] }),
  author: one(users, { fields: [blogs.authorId], references: [users.id] }),
  category: one(categories, { fields: [blogs.categoryId], references: [categories.id] }),
  featuredImage: one(media, { fields: [blogs.featuredImageId], references: [media.id] }),
  tagLinks: many(blogTags),
}));
export const blogTagRelations = relations(blogTags, ({ one }) => ({
  blog: one(blogs, { fields: [blogTags.blogId], references: [blogs.id] }),
  tag: one(tags, { fields: [blogTags.tagId], references: [tags.id] }),
}));
export const activityRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, { fields: [activityLogs.userId], references: [users.id] }),
  website: one(websites, { fields: [activityLogs.websiteId], references: [websites.id] }),
}));

export const pageRelations = relations(pages, ({ one }) => ({
  website: one(websites, { fields: [pages.websiteId], references: [websites.id] }),
}));

export const versionRelations = relations(versions, ({ one }) => ({
  user: one(users, { fields: [versions.userId], references: [users.id] }),
}));
