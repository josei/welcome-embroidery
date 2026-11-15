// The phone Menu starts most groups folded, so a row is not in the DOM until its group heading is tapped. This taps folded headings
// one at a time until the row is listed, and returns its locator.
export async function revealMenuRow(list,id){
 const row=list.locator(`#${id}`);
 for(;;){
  if(await row.count()) return row;
  const folded=list.locator('.menu-section[aria-expanded="false"]').first();
  if(!(await folded.count())) return row;
  await folded.click();
 }
}
