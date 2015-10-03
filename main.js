"use strict";

/**
 * Main script for VK group members fetcher.
 *
 * Launches a web worker to do a long task of getting full list of VK group members.
 *
 * by Sergei Sokolov <hello@sergeisokolov.com>
 * Moscow, Russia, 2015.
 */

var App = (function(w,d,$,VK){
	return {
		worker: {}
		,vkScript: {}
		,defaults: {
			appId:	0
			,v:		5.37
		}
		,props:	{}
		,ids: []
		,init:	function(opts) {
			if( !w.Worker) {
				console.log("No Worker API");
				return;
			}
			
			this.props = $.extend( {}, this.defaults, opts);
			
			// load vk script files
			this.loadScript('guess');
			this.loadScript('getMembers');

			// jQuery objects
			this.$cUser 	= $('.vk-user');
			this.$cAnon 	= $('.vk-anon');

			this.$input		= $('#i-groupname');
			this.$btn		= $('#btn-send');
			this.$out		= $('#b-out');
			this.$login		= $('#btn-login');
			this.$logout	= $('#btn-logout');


			// Events
			this.$login.on('click', this.login.bind(this));
			this.$logout.on('click', this.logout.bind(this));
			
			this.$btn.on('click', this.onClick.bind(this));
			this.worker.onmessage = this.onMessage.bind(this);

			VK.init({ apiId: this.props.appId});
			VK.Auth.getLoginStatus( this.gotLoginStatus.bind(this));
		}
		
		,loadScript: function(key) {
			$.ajax('vkscript/' + key + '.js', {
					error		: this.gotVkScriptError.bind(this, key) 
					,success	: this.gotVkScript.bind(this, key)
					,dataType	: 'html'
				}
			);
		}
		
		,gotVkScript: function( key, data) {
			this.vkScript[key] = data;
		}
		
		,gotVkScriptError: function( key, xhr) {
			console.log('ERROR Getting vk script: ' + key, arguments);
		}
		
		,ready: function() {
			this.worker = new Worker("vkWorker.js");
			this.worker.onmessage = this.onMessage.bind(this);
		}
		
		,gotLoginStatus: function( response) {
			console.log('got status: ', response);
			if (response.session) {
				//console.log('vk user: ' + response.session.mid);
				this.token = response.session.sid;
				
				this.$cUser.removeClass('hidden');
				this.$cAnon.addClass('hidden');

				this.ready();
			} else {
				console.log('not auth');

				this.$cUser.addClass('hidden');
				this.$cAnon.removeClass('hidden');
			}
		}
		
		,logout: function(){
			console.log("will log out");
			VK.Auth.logout( this.gotLoginStatus.bind(this));
		}
		
		,login: function(){
			console.log("will log in");
			VK.Auth.login( this.gotLoginStatus.bind(this), 0x40000);
		}
		
		,onMessage: function(e) {
			if( e.data  &&  e.data.ids) {
				this.ids = e.data.ids;
				console.log("Received " + this.ids.length + " ids");
				return;
			}
			
			this.$out.html( e.data);
			console.log('Message received from worker', e);
		}
		
		,onClick: function() {
			this.$input.attr("disabled", true);
			this.guess( this.$input.val());
			
			//console.log('Message posted to worker');
		}
		
		,terminate: function() {
			this.worker.terminate();
		}
		
		,guess: function(input) {
			var m, oid = 0, screen_name = "";
			if( m = input.match(/^(https?:\/\/)?(m\.)?vk\.com\/([a-z_\.0-9-]+)$/)) {	// url
				screen_name = m[3].toLowerCase();
			} else if( m = input.match(/^-?[0-9]+$/)) {									// number
				oid = input;
			} else if( m = input.match(/^[a-z_\.0-9-]+$/)){								// shortname
				screen_name = input.toLowerCase();
			}
			console.log("oid:",oid,"sn:", screen_name);
			// query VK for group details
			VK.Api.call(
				'execute',
				{
					code		: this.vkScript.guess,
					oid			: oid,
					screen_name	: screen_name,
					v			: this.props.v,
				},
				this.gotResolvedName.bind(this)
			);
		}
		
		,gotResolvedName: function(r) {
			//console.log("Got resolved:", r.response.oid, r);
			if( r.response  &&  r.response.oid) {
				console.log("oid: " , r.response.oid);
				this.collect( r.response.oid, r.response.mass);
			} else {
				this.$input.removeAttr("disabled");
				console.log('no oid');
			}
		}
		
		,collect: function( oid, mass) {
			this.worker.postMessage( {oid: oid, mass: mass, token: this.token, code: this.vkScript.getMembers, v: this.props.v});
		}
	};
})(window, document, jQuery, window.VK);
