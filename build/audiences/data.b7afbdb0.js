!function(t){var e={};function r(n){if(e[n])return e[n].exports;var o=e[n]={i:n,l:!1,exports:{}};return t[n].call(o.exports,o,o.exports,r),o.l=!0,o.exports}r.m=t,r.c=e,r.d=function(t,e,n){r.o(t,e)||Object.defineProperty(t,e,{enumerable:!0,get:n})},r.r=function(t){"undefined"!==typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},r.t=function(t,e){if(1&e&&(t=r(t)),8&e)return t;if(4&e&&"object"===typeof t&&t&&t.__esModule)return t;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:t}),2&e&&"string"!=typeof t)for(var o in t)r.d(n,o,function(e){return t[e]}.bind(null,o));return n},r.n=function(t){var e=t&&t.__esModule?function(){return t.default}:function(){return t};return r.d(e,"a",e),e},r.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},r.p="",r(r.s=642)}({235:function(t,e){t.exports=lodash},3:function(t,e,r){var n=r(57)();t.exports=n;try{regeneratorRuntime=n}catch(o){"object"===typeof globalThis?globalThis.regeneratorRuntime=n:Function("r","regeneratorRuntime = r")(n)}},30:function(t,e){function r(e){return t.exports=r="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},t.exports.__esModule=!0,t.exports.default=t.exports,r(e)}t.exports=r,t.exports.__esModule=!0,t.exports.default=t.exports},5:function(t,e){t.exports=function(t,e,r){return e in t?Object.defineProperty(t,e,{value:r,enumerable:!0,configurable:!0,writable:!0}):t[e]=r,t},t.exports.__esModule=!0,t.exports.default=t.exports},57:function(t,e,r){var n=r(30).default;function o(){"use strict";t.exports=o=function(){return e},t.exports.__esModule=!0,t.exports.default=t.exports;var e={},r=Object.prototype,a=r.hasOwnProperty,i="function"==typeof Symbol?Symbol:{},s=i.iterator||"@@iterator",u=i.asyncIterator||"@@asyncIterator",c=i.toStringTag||"@@toStringTag";function p(t,e,r){return Object.defineProperty(t,e,{value:r,enumerable:!0,configurable:!0,writable:!0}),t[e]}try{p({},"")}catch(j){p=function(t,e,r){return t[e]=r}}function f(t,e,r,n){var o=e&&e.prototype instanceof h?e:h,a=Object.create(o.prototype),i=new S(n||[]);return a._invoke=function(t,e,r){var n="suspendedStart";return function(o,a){if("executing"===n)throw new Error("Generator is already running");if("completed"===n){if("throw"===o)throw a;return L()}for(r.method=o,r.arg=a;;){var i=r.delegate;if(i){var s=P(i,r);if(s){if(s===d)continue;return s}}if("next"===r.method)r.sent=r._sent=r.arg;else if("throw"===r.method){if("suspendedStart"===n)throw n="completed",r.arg;r.dispatchException(r.arg)}else"return"===r.method&&r.abrupt("return",r.arg);n="executing";var u=l(t,e,r);if("normal"===u.type){if(n=r.done?"completed":"suspendedYield",u.arg===d)continue;return{value:u.arg,done:r.done}}"throw"===u.type&&(n="completed",r.method="throw",r.arg=u.arg)}}}(t,r,i),a}function l(t,e,r){try{return{type:"normal",arg:t.call(e,r)}}catch(j){return{type:"throw",arg:j}}}e.wrap=f;var d={};function h(){}function g(){}function y(){}var v={};p(v,s,(function(){return this}));var m=Object.getPrototypeOf,b=m&&m(m(T([])));b&&b!==r&&a.call(b,s)&&(v=b);var x=y.prototype=h.prototype=Object.create(v);function w(t){["next","throw","return"].forEach((function(e){p(t,e,(function(t){return this._invoke(e,t)}))}))}function O(t,e){function r(o,i,s,u){var c=l(t[o],t,i);if("throw"!==c.type){var p=c.arg,f=p.value;return f&&"object"==n(f)&&a.call(f,"__await")?e.resolve(f.__await).then((function(t){r("next",t,s,u)}),(function(t){r("throw",t,s,u)})):e.resolve(f).then((function(t){p.value=t,s(p)}),(function(t){return r("throw",t,s,u)}))}u(c.arg)}var o;this._invoke=function(t,n){function a(){return new e((function(e,o){r(t,n,e,o)}))}return o=o?o.then(a,a):a()}}function P(t,e){var r=t.iterator[e.method];if(void 0===r){if(e.delegate=null,"throw"===e.method){if(t.iterator.return&&(e.method="return",e.arg=void 0,P(t,e),"throw"===e.method))return d;e.method="throw",e.arg=new TypeError("The iterator does not provide a 'throw' method")}return d}var n=l(r,t.iterator,e.arg);if("throw"===n.type)return e.method="throw",e.arg=n.arg,e.delegate=null,d;var o=n.arg;return o?o.done?(e[t.resultName]=o.value,e.next=t.nextLoc,"return"!==e.method&&(e.method="next",e.arg=void 0),e.delegate=null,d):o:(e.method="throw",e.arg=new TypeError("iterator result is not an object"),e.delegate=null,d)}function _(t){var e={tryLoc:t[0]};1 in t&&(e.catchLoc=t[1]),2 in t&&(e.finallyLoc=t[2],e.afterLoc=t[3]),this.tryEntries.push(e)}function E(t){var e=t.completion||{};e.type="normal",delete e.arg,t.completion=e}function S(t){this.tryEntries=[{tryLoc:"root"}],t.forEach(_,this),this.reset(!0)}function T(t){if(t){var e=t[s];if(e)return e.call(t);if("function"==typeof t.next)return t;if(!isNaN(t.length)){var r=-1,n=function e(){for(;++r<t.length;)if(a.call(t,r))return e.value=t[r],e.done=!1,e;return e.value=void 0,e.done=!0,e};return n.next=n}}return{next:L}}function L(){return{value:void 0,done:!0}}return g.prototype=y,p(x,"constructor",y),p(y,"constructor",g),g.displayName=p(y,c,"GeneratorFunction"),e.isGeneratorFunction=function(t){var e="function"==typeof t&&t.constructor;return!!e&&(e===g||"GeneratorFunction"===(e.displayName||e.name))},e.mark=function(t){return Object.setPrototypeOf?Object.setPrototypeOf(t,y):(t.__proto__=y,p(t,c,"GeneratorFunction")),t.prototype=Object.create(x),t},e.awrap=function(t){return{__await:t}},w(O.prototype),p(O.prototype,u,(function(){return this})),e.AsyncIterator=O,e.async=function(t,r,n,o,a){void 0===a&&(a=Promise);var i=new O(f(t,r,n,o),a);return e.isGeneratorFunction(r)?i:i.next().then((function(t){return t.done?t.value:i.next()}))},w(x),p(x,c,"Generator"),p(x,s,(function(){return this})),p(x,"toString",(function(){return"[object Generator]"})),e.keys=function(t){var e=[];for(var r in t)e.push(r);return e.reverse(),function r(){for(;e.length;){var n=e.pop();if(n in t)return r.value=n,r.done=!1,r}return r.done=!0,r}},e.values=T,S.prototype={constructor:S,reset:function(t){if(this.prev=0,this.next=0,this.sent=this._sent=void 0,this.done=!1,this.delegate=null,this.method="next",this.arg=void 0,this.tryEntries.forEach(E),!t)for(var e in this)"t"===e.charAt(0)&&a.call(this,e)&&!isNaN(+e.slice(1))&&(this[e]=void 0)},stop:function(){this.done=!0;var t=this.tryEntries[0].completion;if("throw"===t.type)throw t.arg;return this.rval},dispatchException:function(t){if(this.done)throw t;var e=this;function r(r,n){return i.type="throw",i.arg=t,e.next=r,n&&(e.method="next",e.arg=void 0),!!n}for(var n=this.tryEntries.length-1;n>=0;--n){var o=this.tryEntries[n],i=o.completion;if("root"===o.tryLoc)return r("end");if(o.tryLoc<=this.prev){var s=a.call(o,"catchLoc"),u=a.call(o,"finallyLoc");if(s&&u){if(this.prev<o.catchLoc)return r(o.catchLoc,!0);if(this.prev<o.finallyLoc)return r(o.finallyLoc)}else if(s){if(this.prev<o.catchLoc)return r(o.catchLoc,!0)}else{if(!u)throw new Error("try statement without catch or finally");if(this.prev<o.finallyLoc)return r(o.finallyLoc)}}}},abrupt:function(t,e){for(var r=this.tryEntries.length-1;r>=0;--r){var n=this.tryEntries[r];if(n.tryLoc<=this.prev&&a.call(n,"finallyLoc")&&this.prev<n.finallyLoc){var o=n;break}}o&&("break"===t||"continue"===t)&&o.tryLoc<=e&&e<=o.finallyLoc&&(o=null);var i=o?o.completion:{};return i.type=t,i.arg=e,o?(this.method="next",this.next=o.finallyLoc,d):this.complete(i)},complete:function(t,e){if("throw"===t.type)throw t.arg;return"break"===t.type||"continue"===t.type?this.next=t.arg:"return"===t.type?(this.rval=this.arg=t.arg,this.method="return",this.next="end"):"normal"===t.type&&e&&(this.next=e),d},finish:function(t){for(var e=this.tryEntries.length-1;e>=0;--e){var r=this.tryEntries[e];if(r.finallyLoc===t)return this.complete(r.completion,r.afterLoc),E(r),d}},catch:function(t){for(var e=this.tryEntries.length-1;e>=0;--e){var r=this.tryEntries[e];if(r.tryLoc===t){var n=r.completion;if("throw"===n.type){var o=n.arg;E(r)}return o}}throw new Error("illegal catch attempt")},delegateYield:function(t,e,r){return this.delegate={iterator:T(t),resultName:e,nextLoc:r},"next"===this.method&&(this.arg=void 0),d}},e}t.exports=o,t.exports.__esModule=!0,t.exports.default=t.exports},642:function(t,e,r){"use strict";r.r(e),r.d(e,"store",(function(){return P}));var n=r(5),o=r.n(n),a=r(3),i=r.n(a),s=r(81),u=r(235);function c(t,e){var r=Object.keys(t);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(t);e&&(n=n.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),r.push.apply(r,n)}return r}function p(t){for(var e=1;e<arguments.length;e++){var r=null!=arguments[e]?arguments[e]:{};e%2?c(Object(r),!0).forEach((function(e){o()(t,e,r[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(r)):c(Object(r)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(r,e))}))}return t}var f=function(t,e){return t.error||e.error?0:t.menu_order<e.menu_order?-1:t.menu_order>e.menu_order?1:t.title.rendered<e.title.rendered?-1:t.title.rendered>e.title.rendered?1:0};function l(t,e){var r=Object.keys(t);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(t);e&&(n=n.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),r.push.apply(r,n)}return r}function d(t){for(var e=1;e<arguments.length;e++){var r=null!=arguments[e]?arguments[e]:{};e%2?l(Object(r),!0).forEach((function(e){o()(t,e,r[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(r)):l(Object(r)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(r,e))}))}return t}var h=wp.apiFetch,g=wp.data.registerStore,y=wp.url.addQueryArgs,v={estimates:{},fields:[],pagination:{},post:s.c,posts:[],isLoading:!1,isUpdating:!1,isDeleting:!1};h.use((function(t,e){return t.path&&(t.path=t.path.replace("wp/v2/audiences","accelerate/v1/audiences")),e(t)}));var m={FETCH_FROM_API:function(t){return h(t.options)},RESPONSE_TO_JSON:function(t){return t.response.json()}},b={setFields:function(t){return{type:"SET_FIELDS",fields:t}},addPosts:function(t){return{type:"ADD_POSTS",posts:t}},addEstimate:function(t,e){return{type:"ADD_ESTIMATE",audience:t,estimate:e}},removePost:function(t){return{type:"REMOVE_POST",id:t}},setCurrentPost:function(t){return{type:"SET_CURRENT_POST",post:t}},updateCurrentPost:function(t){return{type:"UPDATE_CURRENT_POST",post:t}},setIsLoading:function(t){return{type:"SET_IS_LOADING",isLoading:t}},setIsUpdating:function(t){return{type:"SET_IS_UPDATING",isUpdating:t}},setIsDeleting:function(t){return{type:"SET_IS_DELETING",isDeleting:t}},setPagination:function(t,e){return{type:"SET_PAGINATION",total:t,pages:e}},fetch:function(t){return{type:"FETCH_FROM_API",options:t}},json:function(t){return{type:"RESPONSE_TO_JSON",response:t}}},x={createPost:i.a.mark((function t(e){var r;return i.a.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,b.setIsUpdating(!0);case 2:return t.next=4,b.fetch({path:"accelerate/v1/audiences",method:"POST",data:e});case 4:return r=t.sent,t.next=7,b.addPosts([r]);case 7:return t.next=9,b.updateCurrentPost(r);case 9:return t.abrupt("return",b.setIsUpdating(!1));case 10:case"end":return t.stop()}}),t)})),updatePost:i.a.mark((function t(e){var r;return i.a.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:if(e.id){t.next=2;break}return t.abrupt("return");case 2:return t.next=4,b.setIsUpdating(!0);case 4:return e.title&&!e.title.raw&&(e.title.raw=e.title.rendered),t.next=7,b.fetch({path:"accelerate/v1/audiences/".concat(e.id),method:"PATCH",data:e});case 7:return r=t.sent,t.next=10,b.updateCurrentPost(r);case 10:return t.abrupt("return",b.setIsUpdating(!1));case 11:case"end":return t.stop()}}),t)})),deletePost:i.a.mark((function t(e){return i.a.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,b.setIsDeleting(!0);case 2:return t.next=4,b.fetch({path:"accelerate/v1/audiences/".concat(e),method:"DELETE"});case 4:return t.next=6,b.removePost(e);case 6:return t.abrupt("return",b.setIsDeleting(!1));case 7:case"end":return t.stop()}}),t)}))},w={getFields:function(t){return t.fields},getEstimate:function(t,e){var r=JSON.stringify(e);return t.estimates[r]||{count:0,isLoading:!1,total:0,histogram:new Array(28).fill({count:1})}},getPost:function(t,e){return t.posts.find((function(t){return t.id===e}))},getCurrentPost:function(t){return t.post},getPosts:function(t){return t.posts},getPagination:function(t){return t.pagination},getIsLoading:function(t){return t.isLoading},getIsUpdating:function(t){return t.isUpdating},getIsDeleting:function(t){return t.isDeleting}},O={getFields:i.a.mark((function t(){var e;return i.a.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,b.fetch({path:"accelerate/v1/audiences/fields"});case 2:return e=t.sent,t.abrupt("return",b.setFields(e));case 4:case"end":return t.stop()}}),t)})),getEstimate:i.a.mark((function t(e){var r,n;return i.a.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return t.next=2,b.addEstimate(e,{count:0,isLoading:!0,total:0,histogram:new Array(28).fill({count:1})});case 2:return r=encodeURIComponent(JSON.stringify(e)),t.next=5,b.fetch({path:"accelerate/v1/audiences/estimate?audience=".concat(r)});case 5:return(n=t.sent).histogram=n.histogram||new Array(28).fill({count:1}),n.isLoading=!1,t.abrupt("return",b.addEstimate(e,n));case 9:case"end":return t.stop()}}),t)})),getPost:i.a.mark((function t(e){var r,n,o=arguments;return i.a.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:if(r=o.length>1&&void 0!==o[1]?o[1]:{},e){t.next=3;break}return t.abrupt("return");case 3:return t.next=5,b.setIsLoading(!0);case 5:return r=Object.assign({context:"view"},r),t.prev=6,t.next=9,b.fetch({path:y("accelerate/v1/audiences/".concat(e),r)});case 9:return"auto-draft"===(n=t.sent).status&&(n.title.rendered=""),n.audience||(n.audience=s.a),t.next=14,b.addPosts([n]);case 14:t.next=20;break;case 16:return t.prev=16,t.t0=t.catch(6),t.next=20,b.addPosts([{id:e,error:t.t0}]);case 20:return t.abrupt("return",b.setIsLoading(!1));case 21:case"end":return t.stop()}}),t,null,[[6,16]])})),getCurrentPost:i.a.mark((function t(e){var r,n,o=arguments;return i.a.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:if(r=o.length>1&&void 0!==o[1]?o[1]:{},e){t.next=3;break}return t.abrupt("return");case 3:return t.next=5,b.setIsLoading(!0);case 5:return r=Object.assign({context:"view"},r),t.next=8,b.fetch({path:y("accelerate/v1/audiences/".concat(e),r)});case 8:return"auto-draft"===(n=t.sent).status&&(n.title.rendered=""),n.audience||(n.audience=s.a),t.next=13,b.addPosts([n]);case 13:return t.next=15,b.setCurrentPost(n);case 15:return t.abrupt("return",b.setIsLoading(!1));case 16:case"end":return t.stop()}}),t)})),getPosts:i.a.mark((function t(){var e,r,n,o=arguments;return i.a.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:return e=o.length>0&&void 0!==o[0]?o[0]:{},t.next=3,b.setIsLoading(!0);case 3:return e=Object.assign({context:"edit",per_page:20,page:1,search:"",status:"publish,draft"},e),t.next=6,b.fetch({path:y("accelerate/v1/audiences",e),headers:{"Access-Control-Expose-Headers":"X-WP-Total, X-WP-TotalPages"},parse:!1});case 6:return r=t.sent,t.next=9,b.json(r);case 9:return n=t.sent,t.next=12,b.addPosts(n);case 12:return t.next=14,b.setPagination(r.headers.get("x-wp-total"),r.headers.get("x-wp-totalpages"));case 14:return t.abrupt("return",b.setIsLoading(!1));case 15:case"end":return t.stop()}}),t)}))},P=g("audience",{actions:d(d({},b),x),controls:m,initialState:v,reducer:function(t,e){switch(e.type){case"SET_FIELDS":return p(p({},t),{},{fields:e.fields});case"ADD_ESTIMATE":var r=JSON.stringify(e.audience);return p(p({},t),{},{estimates:p(p({},t.estimates),{},o()({},r,e.estimate))});case"ADD_POSTS":var n=Object(u.unionBy)(e.posts,t.posts,(function(t){return t.id}));return n.sort(f),p(p({},t),{},{posts:n});case"REMOVE_POST":return p(p({},t),{},{pagination:{total:t.pagination.total-1,pages:Math.floor((t.pagination.total-1)/20)},posts:t.posts.filter((function(t){return t.id!==e.id}))});case"SET_CURRENT_POST":if(!e.post.id)return p(p({},t),{},{post:p({},e.post)});var a=t.posts.map((function(t){return t.id!==e.post.id?t:p({},e.post)}));return a.sort(f),p(p({},t),{},{posts:a,post:p({},e.post)});case"UPDATE_CURRENT_POST":if(!e.post.id)return p(p({},t),{},{post:p(p({},t.post),e.post)});var i=t.posts.map((function(t){return t.id!==e.post.id?t:p(p({},t),e.post)}));return i.sort(f),p(p({},t),{},{posts:i,post:p(p({},t.post),e.post)});case"SET_IS_LOADING":return p(p({},t),{},{isLoading:e.isLoading});case"SET_IS_UPDATING":return p(p({},t),{},{isUpdating:e.isUpdating});case"SET_IS_DELETING":return p(p({},t),{},{isDeleting:e.isDeleting});case"SET_PAGINATION":return p(p({},t),{},{pagination:{total:e.total,pages:e.pages}});default:return t}},resolvers:O,selectors:w})},81:function(t,e,r){"use strict";r.d(e,"d",(function(){return n})),r.d(e,"b",(function(){return o})),r.d(e,"a",(function(){return a})),r.d(e,"c",(function(){return i}));var n={field:"",operator:"=",value:"",type:"string"},o={include:"any",rules:[n]},a={include:"all",groups:[o]},i={title:{rendered:"",raw:""},audience:a,status:"draft"}}});