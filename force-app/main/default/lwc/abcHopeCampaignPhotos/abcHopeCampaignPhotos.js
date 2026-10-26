/**
 * Campaign photos for the ABC Hope site, by campaign theme. Free Unsplash photos (Unsplash
 * License). Shared by the dashboard cards, the campaign detail page and the donation journey
 * so a campaign always shows the same picture.
 */
const PHOTOS = {
  presents: {
    id: "photo-1634038036367-7c0e7a95fa4c",
    credit: "Photo: Yevhen Buzuk / Unsplash"
  },
  meal: {
    id: "photo-1766688350317-a74650b69e0e",
    credit: "Photo: Anthony Cantin / Unsplash"
  },
  christmas: {
    id: "photo-1606916693216-69bd7e1cf2fa",
    credit: "Photo: Christian Bowen / Unsplash"
  },
  water: {
    id: "photo-1740741705746-74e6f9b93b4f",
    credit: "Photo: Lisa Marie Theck / Unsplash"
  },
  school: {
    id: "photo-1573894998033-c0cef4ed722b",
    credit: "Photo: Yogendra Singh / Unsplash"
  },
  sprout: {
    id: "photo-1678897482068-e89e03eb4a3a",
    credit: "Photo: Kate Cullen / Unsplash",
    // Tall photo: keep the leaves in view in wide crops.
    focus: "crop=focalpoint&fp-x=0.45&fp-y=0.4"
  },
  gift: {
    id: "photo-1488521787991-ed7bbaae773c",
    credit: "Photo: Larm Rmah / Unsplash"
  }
};

/** "presents" | "meal" | "christmas" | "water" | "school" | "sprout" | "gift", from the campaign name. */
export function campaignTheme(name) {
  const n = (name || "").toLowerCase();
  if (/toy|present/.test(n)) return "presents";
  if (/meal|food/.test(n)) return "meal";
  if (/christmas/.test(n)) return "christmas";
  if (/water/.test(n)) return "water";
  if (/school|educat|scholar|girl/.test(n)) return "school";
  if (/tree|green|environment|plant/.test(n)) return "sprout";
  return "gift";
}

/** { url, credit } for a campaign; size the crop with width (and optional height). */
export function campaignPhoto(name, { width = 900, height } = {}) {
  const photo = PHOTOS[campaignTheme(name)];
  const size = `w=${width}${height ? `&h=${height}` : ""}`;
  return {
    url: `https://images.unsplash.com/${photo.id}?auto=format&fit=crop${photo.focus ? `&${photo.focus}` : ""}&${size}&q=75`,
    credit: photo.credit
  };
}
