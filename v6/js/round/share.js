import { S } from '../core/state.js';
import { expose } from '../core/expose.js';
import { formatDateForFilename } from '../core/util.js';
import { exportToExcel, generateExcelWorkbook } from './export.js';

function emailResults(){
  const player = document.getElementById('playerName').value || 'Player';
  const course = document.getElementById('courseName').value || 'Course';
  const date = document.getElementById('roundDate').value;
  const d = S.totalStrokes - S.totalPar;
  const scoreStr = `${S.totalStrokes} (${d===0?'E':(d>0?'+':'')+d})`;
  
  // Generate Excel file as blob
  const wb = generateExcelWorkbook();
  const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
  const blob = new Blob([wbout], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const file = new File([blob], `${player}_${course}_${formatDateForFilename(date)}.xlsx`, {type: blob.type});
  
  // Try Web Share API with file (works on iOS/Android)
  if(navigator.canShare && navigator.canShare({files:[file]})){
    navigator.share({
      title: `Golf Round - ${player} at ${course}`,
      text: `${player} at ${course} - ${scoreStr}`,
      files: [file]
    }).catch(()=>{});
  } else {
    // Fallback: download file then open mailto
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    
    const subject = encodeURIComponent(`Golf Round - ${player} at ${course} - ${scoreStr}`);
    const body = encodeURIComponent(`Attached: ${file.name}`);
    setTimeout(()=>{
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }, 300);
    alert('Excel file downloaded. Please attach it to the email that opens.');
  }
}

function uploadToGoogleDrive(){
  // Generate the Excel file as a blob and open Google Drive upload
  if(typeof XLSX === 'undefined'){
    alert('Excel library not loaded. Please try Save Excel first, then upload manually.');
    return;
  }
  
  // Trigger Excel download first so user has the file
  exportToExcel();
  
  // Small delay then open Google Drive
  setTimeout(()=>{
    window.open('https://drive.google.com/drive/my-drive', '_blank');
    alert('Your Excel file has been downloaded. Drag it into the Google Drive tab that just opened, or use the "+ New" button to upload.');
  }, 500);
}

// Functions called from inline HTML handlers
expose({ emailResults });
