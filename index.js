// import all needed libs bro
const  express=require('express')
const  {Server}=require('socket.io')
const  http=require('http')
const {use} = require("express/lib/application");

// app bnao express ki
const app=express();
// make http server too and pass the app
const server=http.createServer(app);

// make a socket and pass the   server to it
const  io=new Server(server);

function  getRoomName(a,b){
    return [a,b].sort().join('_'); // sort to avoid duplicates
}

const users={}; // map id to socket id
// now jb bhi koi is server se connect hoga to usko ik id assign hogi
// later on connect honay ke baad woh koi room bhi join krskta
io.on('connection',socket => {
        console.log('connected on ',socket.id);

        // register every user bro
        socket.on('register',(userId)=>{
            users[userId]=socket.id;
            console.log("User registered",userId);
        });

        // call user
        // USER A is caller
        socket.on('call_user',(from,to)=>{
             // if a is current user force it
            let sidOfB=users[to];
            if(sidOfB){ // means is actually registered
                // notify user B
                socket.to(sidOfB).emit('incomming_call',{from});
            }else{
                socket.emit('404');
        });
        // as it was emitted to B if B accepts the call
        // it emmits a eveent to A that call is accepted ,passive  from is B now and to is A
        socket.on('call_accepted',({from ,to})=>{
            let sidOfA=users[to];
            if(sidOfA){ // 100% exists kray gi lkn :haha
                // make a room of A and B
                socket.join(getRoomName(from,to));
                // emit it to user A CLient Side
                socket.to(sidOfA).emit('call_accepted',{from});
            }
        });

        socket.on('call_rejected',({from ,to})=>{
            let sidOfA=users[to];
            if(sidOfA){ // 100% exists kray gi lkn :haha
                // make a room of A and B
                socket.join(getRoomName(from,to));
                // emit it to user A CLient Side
                socket.to(sidOfA).emit('call_rejected',{from});
            }
        });

        // if call was accepted BY B and A recived eventt abt call accpeted then it joins the same room which B
       // has already joined
        socket.on('join',(a,b)=>{
            socket.join(getRoomName(a,b));
        });


        // as join hogay hain now they can share offer
        // Offer Relay hona abb
        socket.on('offer',(from,to,offer)=>{
            console.log('redirecting offer from ',from,' to ',to);
           socket.to(getRoomName(from,to)).emit('offer',offer);
        });

        //
        socket.on('answer',(from,to,answer)=>{
            console.log('answer from ',from,' to ',to);
            socket.to(getRoomName(from,to)).emit('answer',answer);
        });
        // now IF answer was good we need a channel to share ICE candidates
        socket.on('ICE',(from,to,ICEs)=>{
            console.log('ICE from ',from,' to ',to);
            socket.to(getRoomName(from,to)).emit('ICE',ICEs);
        });
        socket.on('disconnect',()=>{
           for (let id in users){
               if(users[id]===socket.id) delete users[id];
           }
           console.log('disconnected',socket.id);
        });
    }
);
server.listen(8000,() => {
   console.log('Server Started');
});
