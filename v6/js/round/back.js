// Back button inside the shot-by-shot scoring flow.
import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { show } from '../core/router.js';
import { ordinal } from '../core/util.js';
import { refreshFullStats } from './edit-hole.js';
import { undoLastHole } from './shot-entry.js';

// v3.0.0 - Simplified goBack - stats only counted when hole finishes
function goBack(){
  const currentPage=document.querySelector('.page.active').id;
  
  // FROM PAR PAGE - Go back to round info OR undo previous hole
  if(currentPage==='parPage'){
    if(S.editingHoleIndex !== null){
      S.editingHoleIndex = null;
      scoreBar.style.display = 'none';
      refreshFullStats(6);
      show('fullStatsPage');
      return;
    }
    if(S.currentHole>1&&S.allHoles.length>0){
      undoLastHole();
    }else{
      scoreBar.style.display='none';
      show('roundPage');
    }
    return;
  }
  
  // FROM LIE PAGE
  if(currentPage==='liePage'){
    if(S.shots<=1){
      // First shot - go back to par page
      S.currentHoleShots=[];
      S.shots=1;
      if(S.editingHoleIndex !== null){
        if(confirm('Cancel editing this hole?')){
          S.editingHoleIndex = null;
          scoreBar.style.display = 'none';
          refreshFullStats(6);
          show('fullStatsPage');
        }else{
          S.currentHoleShots.push({shotNum:1,lie:null,distanceBefore:S.currentYards,distanceAfter:null,isPutt:false});
        }
      }else{
        show('parPage');
      }
    }else{
      // Later shot - remove current shot, go back to distance for previous
      S.currentHoleShots.pop();
      S.shots--;
      const prevShot=S.currentHoleShots[S.currentHoleShots.length-1];
      if(prevShot) prevShot.lie=null;
      distanceTitle.innerText=`${ordinal(S.shots)} Shot Distance`;
      shotDistance.value=prevShot?prevShot.distanceBefore||100:100;
      show('distancePage');
    }
    return;
  }
  
  // FROM DISTANCE PAGE - go back to lie selection
  // When on distancePage, we've already selected a lie for previous shot and 
  // created a new shot. We need to undo that.
  if(currentPage==='distancePage'){
    // Pop the current shot we were entering distance for
    if(S.currentHoleShots.length > 1) {
      S.currentHoleShots.pop();
      S.shots--;
    }
    // Clear the lie on the previous shot so user can re-select
    const prevShot=S.currentHoleShots[S.currentHoleShots.length-1];
    if(prevShot){
      prevShot.lie=null;
      prevShot.distanceAfter=null;
    }
    lieTitle.innerText=`Where did your ${ordinal(S.shots)} shot end?`;
    show('liePage');
    return;
  }
  
  // FROM PENALTY PAGES
  if(currentPage==='penaltyPage'||currentPage==='obPenaltyPage'||currentPage==='recoveryPage'||currentPage==='missedGreenPage'){
    const currentShot=S.currentHoleShots[S.currentHoleShots.length-1];
    if(currentShot) currentShot.lie=null;
    show('liePage');
    return;
  }
  
  // FROM PUTT PAGE
  if(currentPage==='puttPage'){
    if(S.putts===0){
      // First putt - go back to lie selection
      while(S.currentHoleShots.length>0 && S.currentHoleShots[S.currentHoleShots.length-1].isPutt){
        S.currentHoleShots.pop();
      }
      const approachShot=S.currentHoleShots[S.currentHoleShots.length-1];
      if(approachShot){
        approachShot.lie=null;
        approachShot.distanceAfter=null;
      }
      lieTitle.innerText=`Where did your ${ordinal(S.shots)} shot end?`;
      show('liePage');
    }else{
      // Later putt - go back to previous putt
      if(S.currentHoleShots.length>0) S.currentHoleShots.pop();
      if(S.totalPutts>0) S.totalPutts--;
      S.putts--;
      const prevPutt=S.currentHoleShots[S.currentHoleShots.length-1];
      if(prevPutt&&prevPutt.isPutt){
        prevPutt.distanceAfter=null;
        puttTitle.innerText=`Putt ${S.putts+1}`;
        puttShotNum.innerText=`Shot ${S.shots+S.putts+1}`;
        document.getElementById('puttDistance').value=prevPutt.distanceBefore||3;
      }
    }
    return;
  }
}

// Functions called from inline HTML handlers
expose({ goBack });
