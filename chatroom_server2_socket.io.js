/**
 * Created by Administrator on 2018/2/28 0028.
 */
const http=require('http');
const fs=require('fs');
const mysql=require('mysql');
const  io=require('socket.io');
const url=require('url');
const regs=require('./libs/regs');

//数据库
let db=mysql.createPool({host:'localhost',user:'root',password:'',database:'20171113'});

//1.http服务器
let httpServer=http.createServer((req,res)=>{
    console.log(req.url);
    fs.readFile(`www${req.url}`,(err,data)=>{
        if(err){
            res.writeHeader(404);
            res.write('NOT FOUND');
        }else{
            res.write(data);
        }
        res.end();
    })

});
httpServer.listen(8080);

//2.WebSocket服务器
let wsServer=io.listen(httpServer);
let aSock=[];
wsServer.on('connection',sock=>{
    aSock.push(sock);
    let cur_username='';
    let cur_userID=0;
    //注册
    sock.on('reg',(user,pass)=>{
        //1.校验数据
        if(!regs.username.test(user)){
            sock.emit('reg_ret',1,'用户名不符合规范');
        }else if(!regs.password.test(pass)){
            sock.emit('reg_ret',1,'密码不符合规范');
        }else{
            //2.检验用户名是否重复
            db.query(`SELECT ID FROM user_table WHERE username='${user}'`,(err,data)=>{
                if(err){
                    sock.emit('reg_ret',1,'数据库有错');
                }else if(data.length>0){
                    sock.emit('reg_ret',1,'用户名已存在');
                }else{
                    //3.插入
                    db.query(`INSERT INTO user_table (username,password,online) VALUES('${user}','${pass}',0)`,err=>{
                        if(err){
                            sock.emit('reg_ret',1,'数据库有错');
                        }else{
                            sock.emit('reg_ret',0,'注册成功');
                        }
                    });
                };
            });
        }
    });
    //登录
    sock.on('login',(user,pass)=>{
        //1.校验数据
        if(!regs.username.test(user)){
            sock.emit('login_ret',1,'用户名不符合规范');
        }else if(!regs.password.test(pass)){
            sock.emit('login_ret',1,'密码不符合规范');
        }else{
            //2.取数据
            db.query(`SELECT ID,password FROM user_table WHERE username='${user}'`,(err,data)=>{
                if(err){
                    sock.emit('login_ret',1,'数据库有错');
                }else if(data.length==0){
                    sock.emit('login_ret',1,'用户名不存在');
                }else if(data[0].password!=pass){
                    sock.emit('login_ret',1,'用户名或密码错误');
                }else{
                    //3.设置online状态
                    db.query(`UPDATE user_table SET online=1 WHERE ID='${data[0].ID}'`,err=>{
                        if(err){
                            sock.emit('login_ret',1,'数据库有错');
                        }else{
                            sock.emit('login_ret',0,'登录成功');
                            cur_username=user;
                            cur_userID=data[0].ID;
                        }
                    });
                };
            });
        };
    });
    //发言
    sock.on('msg',txt=>{
        if(!txt){
            sock.emit('msg_ret',1,'消息不能为空');
        }else{
            //广播给所有人
            aSock.forEach(item=>{
                if(item==sock) return;
                item.emit('msg',cur_username,txt);
            });
            sock.emit('msg_ret',0,'发送成功');

        }
    })
    //离线
    sock.on('disconnect',function(){
        db.query(`UPDATE user_table SET online=0 WHERE ID=${cur_userID}`,err=>{
            if(err){
                console.log('数据库出错,'+err);
            };
            cur_username='';
            cur_userID=0;
            //离线时删除sock
            aSock=aSock.filter(item=>item!=sock);
        });
    });
});
