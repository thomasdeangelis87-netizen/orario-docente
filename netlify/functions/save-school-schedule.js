import {makeSchoolScheduleHandler} from './_school_schedule_handler.js';

const shared=makeSchoolScheduleHandler();
export default (req,context)=>req.method==='POST'?shared(req,context):new Response('Metodo non consentito',{status:405});
