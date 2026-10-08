/** Shown while a page reads its address and loads. */
export function PageLoading() {
  return (
    <>
      <header className="top">
        <div className="show">
          <small>Audition Room</small>
          <strong>Loading…</strong>
        </div>
      </header>
      <main className="page" />
    </>
  );
}
