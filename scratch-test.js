const main = async () => {
  console.log("Fetching GC=F M15...");
  const start = Date.now();
  try {
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=15m&range=5d');
    console.log(`Fetch completed in ${Date.now() - start}ms. Status: ${res.status}`);
    const data = await res.json();
    console.log("Data keys:", Object.keys(data));
  } catch (err) {
    console.error("Error fetching M15:", err);
  }

  console.log("Fetching GC=F H1...");
  const startH1 = Date.now();
  try {
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1h&range=14d');
    console.log(`Fetch completed in ${Date.now() - startH1}ms. Status: ${res.status}`);
    const data = await res.json();
    console.log("Data keys:", Object.keys(data));
  } catch (err) {
    console.error("Error fetching H1:", err);
  }
};

main();
