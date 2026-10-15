type CategoryIconName = "전체" | "카페/디저트" | "중식" | "한식" | "패스트푸드" | "일식" | "야식" | "분식" | "양식" | "아시안";

const positions: Record<CategoryIconName, [number, number]> = {
  "전체": [0, 0],
  "카페/디저트": [1, 0],
  "중식": [2, 0],
  "한식": [3, 0],
  "패스트푸드": [0, 1],
  "일식": [1, 1],
  "야식": [2, 1],
  "분식": [3, 1],
  "양식": [0, 0],
  "아시안": [1, 0],
};

export default function CategoryIcon({ category }: { category: CategoryIconName }) {
  if (category === "한식") {
    return <span
      className="block h-[40px] w-[40px] shrink-0 bg-contain bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/category-hansik.png')", backgroundSize: "155% auto" }}
      aria-hidden="true"
    />;
  }
  if (category === "중식") {
    return <span
      className="block h-[36px] w-[36px] shrink-0 bg-no-repeat"
      style={{
        backgroundImage: "url('/category-icons-3d.png')",
        backgroundSize: "440% 220%",
        backgroundPosition: "64.4% 10%",
      }}
      aria-hidden="true"
    />;
  }
  if (category === "양식" || category === "아시안") {
    return <span
      className="block h-[40px] w-[40px] shrink-0 bg-contain bg-center bg-no-repeat"
      style={{
        backgroundImage: "url('/category-icons-new.png')",
        backgroundSize: "200% 100%",
        backgroundPosition: category === "양식" ? "0% 0%" : "100% 0%",
      }}
      aria-hidden="true"
    />;
  }
  const [column, row] = positions[category];
  const columnPosition = category === "일식" ? 35 : column * 100 / 3;
  return <span
    className="block h-[40px] w-[40px] shrink-0 bg-contain bg-center bg-no-repeat"
    style={{
      backgroundImage: "url('/category-icons-3d.png')",
      backgroundSize: "400% 200%",
      backgroundPosition: `${columnPosition}% ${row * 100}%`,
    }}
    aria-hidden="true"
  />;
}
