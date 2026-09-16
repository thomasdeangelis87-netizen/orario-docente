import {makeSchoolScheduleHandler} from './_school_schedule_handler.js';

// Old clients remain supported; the same GET, authorization and data source.
const shared=makeSchoolScheduleHandler();
export default (req,context)=>req.method==='GET'?shared(req,context):new Response('Metodo non consentito',{status:405});
