// Shim for src/lib/context/likes-context.tsx: nothing is liked in the video.
const value = {
  isProductLiked: (_id: string) => false,
  toggleProductLike: (_id: string) => {},
  isOutfitLiked: (_id: string) => false,
  toggleOutfitLike: (_id: string) => {},
  likedProductIds: [] as string[],
  likedOutfitIds: [] as string[],
};

export const useLikes = () => value;
