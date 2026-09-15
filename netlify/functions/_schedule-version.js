function scheduleVersion(previous,publish){
 const current=Math.max(0,Number(previous?.version)|| (previous?.entries?.length?1:0));
 return publish?current+1:current;
}
export {scheduleVersion};
