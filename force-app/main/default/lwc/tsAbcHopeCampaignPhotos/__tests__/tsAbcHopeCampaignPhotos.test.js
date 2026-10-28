import { campaignPhoto, themePhotoUrl } from "c/tsAbcHopeCampaignPhotos";

describe("tsAbcHopeCampaignPhotos", () => {
  it("picks a theme photo from the name when the campaign has no image", () => {
    const p = campaignPhoto("Christmas Toy Drive 2026", {
      width: 400,
      height: 300
    });
    expect(p.url).toContain("images.unsplash.com/photo-1634038036367");
    expect(p.url).toContain("w=400&h=300");
    expect(p.credit).toBe("Photo: Yevhen Buzuk / Unsplash");
  });

  it("uses the campaign's own Unsplash image, sized, with its credit when known", () => {
    const p = campaignPhoto("Anything", {
      width: 1280,
      height: 400,
      imageUrl: themePhotoUrl("water")
    });
    const url = new URL(p.url);
    expect(url.hostname).toBe("images.unsplash.com");
    expect(url.pathname).toBe("/photo-1740741705746-74e6f9b93b4f");
    expect(url.searchParams.get("w")).toBe("1280");
    expect(url.searchParams.get("h")).toBe("400");
    expect(p.credit).toBe("Photo: Lisa Marie Theck / Unsplash");
  });

  it("uses any other image link as is, without a credit", () => {
    const p = campaignPhoto("Clean Water", {
      width: 900,
      imageUrl: " https://cdn.example.org/campaigns/water.jpg "
    });
    expect(p).toEqual({
      url: "https://cdn.example.org/campaigns/water.jpg",
      credit: ""
    });
  });
});
