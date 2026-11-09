export function Search({ value = "" }: { value?: string }) {
  return (
    <form className="search" action="/search" method="get" role="search">
      <input className="input" name="q" defaultValue={value} placeholder="Search a program, certification, ruling or harness address" aria-label="Address" />
      <button className="btn btn-primary" type="submit">Search</button>
    </form>
  );
}
