export default async function teardown() {
  await Promise.all(
    [4100, Number(process.env.E2E_FRONTEND_PORT || 5175)].map((port) =>
      fetch(`http://127.0.0.1:${port}/__e2e/shutdown`, {
        method: "POST",
        headers: { "x-test-key": process.env.E2E_ADMIN_PASSWORD! },
      }).catch(() => {}),
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
