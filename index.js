"use strict";

const portfinder = require('portfinder');
const rpc        = require('json-rpc2');
const Q          = require('q');

function RpcNewClient() {
    return rpc.Client.$create(5555, 'localhost');
}

class Module {

  constructor(name, desc) {
    this.name = name;
    this.desc = desc;
    this.rpc = RpcNewClient();
    this.commands = new Map();
    this.triggers = new Map();
    this.cleanupFunction;
  }

    initialize() {
        const deferred = Q.defer();

        const promises = [
            Q.nbind(this.rpc.connectSocket, this.rpc)()
          , Q.nbind(portfinder.getPort)()
        ]

        Q.all(promises)
        .then((results) => {
            this.Master = results[0]
            this.rpcPort = results[1]
            this.startRpcServer();
            deferred.resolve();
        })
        .fail((error) => {
            deferred.reject(new Error(error))
        });

        return deferred.promise;
  }

  startRpcServer() {
      const server = rpc.Server.$create({});
      server.expose(this.name.toLowerCase(), {
          InvokeCommand: this.invokeCommand.bind(this),
          Dispatch: this.dispatch.bind(this),
          Cleanup: this.cleanup.bind(this)
      });
      server.listenRaw(parseInt(this.rpcPort), 'localhost');
  }

  /* Separate rpc logic from module */

  invokeCommand(cmdData, opt, callback) {
      this.commands.get(cmdData[0].Name).Fun(cmdData[0].Msg, cmdData[0].Args);
      return callback(null, "");
  }

  dispatch(ircData, opt, callback) {
      this.triggers.forEach(function(value, key) {
          value(ircData.Msg);
      }, this.triggers);
      return callback(null, "");
  }

  cleanup(reason, opt, callback) {
      if (this.cleanupFunc) {
          const clean = Q.nbind(this.cleanupFunc(), this)
          clean()
          .then(() => {
              return callback(null, "");
          })
          .fail((error) => {
             return callback(new Error(error), "");
          });
      } else {
          return callback(null, "");
      }
  }

  addCommand(name, hook) {
      const data = {
          "Name": name,
          "Module": this.name
      };
      this.Master.call('Master.RegisterCommand', data, function(err, result) {});
      hook.Fun = hook.Fun.bind(this);
      this.commands.set(name, hook);
  }

  say(chan, text) {
      this.Master.call('Master.Send', chan + " :" + text, function(err, result) {});
  }

  register() {
      const data = {
          "Port": this.rpcPort.toString(),
          "Name": this.name
      };
      this.Master.call('Master.Register', data, function(err, result) {
          if (err) console.error(err);
      });
  }
}

module.exports = Module;
