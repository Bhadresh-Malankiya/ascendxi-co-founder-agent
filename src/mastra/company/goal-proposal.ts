import {knowledgeStore,type GoalInput} from './knowledge-store';
import {planningStore} from './planning-store';
export async function proposeGoal(data:GoalInput){
 const goal=await knowledgeStore().createGoal(data);
    if (goal.status === 'proposed' && !(await planningStore().list()).some(p => p.key === data.key)) {
      await planningStore().propose({ key:data.key, kind:'goal', title:data.title, product:data.product, outcome:data.outcome,
        scope:data.outcome, exclusions:['No external actions, access changes, new services or spending are approved here.'], department:data.department,
        acceptance:data.acceptance, assumptions:['Launch date, capacity and budget are undecided; the target is provisional.'], evidence:['Founder/operator goal proposal; outcome needs evidence-based review.'],
        milestones:[{key:'first-evidence',title:'Prepare the first evidence-backed delivery brief',owner:'product',objective:data.outcome,acceptance:data.acceptance,
          targetDate:new Date(Date.now()+7*86400000).toISOString().slice(0,10),estimateMinutes:null,after:[]}],
        budget:{monthlyCap:null,currency:'USD',note:'Budget undecided. No new spending authorized.'},subjectKey:data.key,requestedAgent:null,toolIds:[],setupUrl:null,manualSteps:[],expectedVersion:0 }, 'operator-proposal');
    }
 return goal;
}
