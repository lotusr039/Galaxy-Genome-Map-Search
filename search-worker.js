importScripts("generator.js","naming.js","search-core.js");

let engine=null,currentJob=null;

self.onmessage=async event=>{
  const message=event.data;
  try{
    if(message.type==="init"){
      GalaxyGenerator.setPixelConversionTable(message.data.pixelConversion);
      engine=new GalaxySearch.SearchEngine(message.data);
      self.postMessage({type:"ready"});return;
    }
    if(!engine)throw new Error("搜索器尚未初始化");
    if(message.type==="cancel"){
      if(currentJob)currentJob.cancelled=true;return;
    }
    if(message.type==="resolve"){
      self.postMessage({type:"resolved",requestId:message.requestId,choices:engine.resolveName(message.name)});return;
    }
    if(message.type==="search"){
      if(currentJob)currentJob.cancelled=true;
      const job={requestId:message.requestId,cancelled:false};currentJob=job;
      const results=await engine.search(message.query,{
        cancelled:()=>job.cancelled,
        progress:value=>self.postMessage({type:"progress",requestId:job.requestId,...value})
      });
      if(!job.cancelled)self.postMessage({type:"results",requestId:job.requestId,results});
      if(currentJob===job)currentJob=null;
    }
  }catch(error){
    if(error.message!=="SEARCH_CANCELLED")self.postMessage({type:"error",requestId:message.requestId,message:error.message||String(error)});
  }
};
