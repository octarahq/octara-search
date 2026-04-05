import http from "node:http";

const query = "youtube";
const url = `http://localhost:3001/api/search?q=${query}`;

http.get(url, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    try {
      const json = JSON.parse(data);
      console.log("Top 10 results for:", query);
      if (!json.results) {
        console.log("No results or error:", json);
        return;
      }
      json.results.slice(0, 10).forEach((r: any, i: number) => {
        console.log(`${i + 1}. [${r.score}] ${r.url}`);
        console.log(`   Title: ${r.title}`);
        console.log(`   Lang: ${r.language}`);
      });
    } catch (e) {
      console.error("Parse error:", e);
      console.log("Data was:", data);
    }
  });
});
