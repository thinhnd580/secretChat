//
// AngilarJS controller
Notification.requestPermission();
function SympleChat($scope) {
    $scope.email = $('#emailInput');
    $scope.password = $('#passwordInput');
    $scope.client;
    $scope.localPlayer;
    $scope.remotePlayer;
    $scope.remoteVideoPeer;
    $scope.handle;
    $scope.directUser;
    $scope.peers = [];
    $scope.currentPeer;
    $scope.messages = [];
    $scope.currentMessages = [];
    $scope.testArray = [];
    $scope.messageText = "";
    $scope.errorText = "";
    $scope.isLogined= false;
    $scope.disableLocalAudio = false; // set true to prevent local feedback loop
    $scope.camera = $('#ss');
    $scope.cameraVideo = $('#camera');
    $scope.cameraHeight = { 'min-height': 0.0 };
    $scope.hideCamera = true;
    $scope.loginView = $('loginView');
    $scope.fuck = 0;
    $scope.currentUserIndex = -1
    $scope.currentPeerAvatar;
    $scope.email;
    $scope.showProfile = true;
    $scope.account = {"thjnh195@gmail.com": "Đức Thịnh",
                        "sonle@gmail.com": "Anh Sơn",
                        "concun@gmail.com": "Con Cún"};
    $scope.avatars = {"Đức Thịnh": "resource/bear1.png",
                        "Anh Sơn": "resource/bear2.png",
                        "Con Cún": "resource/bear3.png"};

    $(document).ready(function() {
        


        // Client
        $scope.client = new Symple.Client(CLIENT_OPTIONS);
        //Init
        $scope.client.on('announce', function(peer) {
            //console.log('announce:', peer)

            $scope.client.join('public'); // join the public room
            $scope.isLoading = false;
            $scope.$apply();
        });

        $scope.client.on('presence', function(p) {
            //console.log('presence:', p)
        });

        $scope.client.on('message', function(m) {
            console.log('message:', m)
            tempMessage = {
                    user: m.from.user,
                    data: m.data,
                    to: m.to,
                    direct: m.direct,
                    time: Symple.formatTime(new Date)
            };
            for (var i = 0; i < $scope.testArray.length; i++) {
                if ($scope.testArray[i].user == m.from.user) {
                    $scope.testArray[i].messages.push(tempMessage);
                    $scope.testArray[i].pending = 1;

                    if ($scope.testArray[i].user == $scope.directUser) {
                        $scope.currentMessages.push(tempMessage);
                        $scope.testArray[i].pending = 0;
                    } else {
                        $scope.testArray[i].pending = 1;
                        $scope.notifyMe(m.data);
                    }

                    break;
                }
            }
            $scope.$apply();
        });

        $scope.client.on('command', function(c) {
            console.log('command:', c)

            if (c.node == 'call:init') {

                if (!c.status) {
                    // Show a dialog to the user asking if they want to accept the call
                    $scope.notifyMe("Incomming Call")
                    var e = $('#incoming-call-modal')
                    e.find('.caller').text('@' + c.from.user)
                    e.find('.accept').unbind('click').click(function() {
                        c.status = 200;
                        $scope.remoteVideoPeer = c.from;
                        $scope.client.respond(c);
                        $scope.$apply();
                        e.modal('hide');
                        $scope.hideCamera = false;
                    })
                    e.find('.reject').unbind('click').click(function() {
                        c.status = 500;
                        $scope.client.respond(c);
                        e.modal('hide');
                        $scope.hideCamera = true;
                    })
                    e.modal('show');
                    $scope.hideCamera = false;
                }
                else if (c.status == 200) {
                    // Handle call accepted
                    $scope.remoteVideoPeer = c.from;
                    $scope.startLocalVideo();
                    $scope.$apply();
                }
                else if (c.status == 500) {
                    // Handle call rejected

                }
                else {
                    alert('Unknown response status')
                }
            }
        });

        $scope.client.on('event', function(e) {
            console.log('event:', e)

            // Only handle events from the remoteVideoPeer
            if (!$scope.remoteVideoPeer || $scope.remoteVideoPeer.id != e.from.id) {
                console.log('mismatch event:', e.from, $scope.remoteVideoPeer)
                return
            }

            // ICE SDP
            if (e.name == 'call:ice:sdp') {
                if (e.sdp.type == 'offer') {

                    // Create the remote player on offer
                    if (!$scope.remotePlayer) {
                        $scope.remotePlayer = createPlayer($scope, 'answerer', '#video .remote-video');
                        $scope.remotePlayer.play();
                    }
                    $scope.remotePlayer.engine.recvRemoteSDP(e.sdp);
                }
                if (e.sdp.type == 'answer') {
                    $scope.localPlayer.engine.recvRemoteSDP(e.sdp);
                }
            }

            // ICE Candidate
            else if (e.name == 'call:ice:candidate') {
                if (e.origin == 'answerer')
                    $scope.localPlayer.engine.recvRemoteCandidate(e.candidate);
                else if (e.origin == 'caller')
                    $scope.remotePlayer.engine.recvRemoteCandidate(e.candidate);
                else
                    alert('Unknown candidate origin');
            }

            else {
                alert('Unknown event: ' + e.name);
            }
        });

        $scope.client.on('disconnect', function() {
            console.log('disconnected')
            $scope.isLoading = false;
            $scope.errorText = 'Disconnected from the server';
            $scope.peers = [];
            $scope.$apply();
        });

        $scope.client.on('error', function(error, message) {
            console.log('connection error:', error, message)
            $scope.isLoading = false;
            $scope.errorText = 'Cannot connect to the server.';
            $scope.$apply();
        });

        $scope.client.on('addPeer', function(peer) {
            console.log('add peer:', peer)
            $scope.peers.push(peer);
            var str = peer.user;
            var avatar = $scope.avatars[peer.user];
            $scope.testArray.push({
                user: peer.user,
                avatar: avatar,
                messages: []
            });
            $scope.$apply();
        });

        $scope.client.on('removePeer', function(peer) {
            console.log('remove peer:', peer)
            for (var i =0; i < $scope.peers.length; i++) {
                if ($scope.peers[i].id === peer.id) {
                    $scope.peers.splice(i,1);
                    $scope.testArray.splice(i,1);
                    $scope.$apply();
                    break;
                }
            }
        });

        // Init handle from URL if available
        var handle = getHandleFromURL();
        if (handle && handle.length) {
            $scope.handle = handle;
            $scope.login();
        }
    });

    
    //
    // Messaging
    $scope.notifyMe = function(message) {

        if (!Notification) {
            alert('Desktop notifications not available in your browser. Try Chromium.'); 
            return;
        }

        if (Notification.permission !== "granted")
            Notification.requestPermission();
        else {
            var notification = new Notification('Notification title', {
              icon: 'resource/iconNinjaBear.png',
              body: message,
        });

        notification.onclick = function () {
            window.open("http://stackoverflow.com/a/13328397/1269037");      
        };
            
        }
    };
    $scope.setMessageTarget = function(user) {
        console.log('setMessageTarget', user)
        $scope.showProfile = false;
        $('#post-message .direct-user').text('@' + user)
        $('#post-message .message-text')[0].focus()
        if (user != $scope.directUser) {
            $scope.currentMessages.splice(0,$scope.currentMessages.length);
            for (var i = 0; i < $scope.testArray.length; i++) {
                console.log($scope.testArray);
                $scope.testArray[i].pending = 0;
                if ( $scope.testArray[i].user == user) {
                    console.log("hehfehfhehf");
                    for (var j=0; j< $scope.testArray[i].messages.length;j++) {
                        console.log("fuck u");
                        console.log($scope.testArray[i].messages[j]);
                        $scope.currentMessages.push($scope.testArray[i].messages[j]);
                    }
                    currentUserIndex = i;
                    $scope.currentPeer = $scope.peers[i];
                    $scope.currentPeerAvatar = $scope.testArray[i].avatar;

                    break;
                }
            }
        }
        $scope.directUser = user ? user : ''

    }

    $scope.sendMessage = function() {
        console.log('sendMessage', $scope.messageText);
        $scope.client.sendMessage({
            data: $scope.messageText,
            to: $scope.directUser,
            direct: $scope.directUser
        });
        for (var i = $scope.testArray.length - 1; i >= 0; i--) {
            if ($scope.testArray[i].user == $scope.directUser) {
                console.log("==================----");
                tempMessage = {
                    to: $scope.directUser,
                    direct: $scope.directUser,
                    user: $scope.handle,
                    data: $scope.messageText,
                    time: Symple.formatTime(new Date)
                }
                $scope.testArray[i].messages.push(tempMessage);
                $scope.currentMessages.push(tempMessage);
                break;
            }
            
        }
        // $scope.messages.push({
        //     to: $scope.directUser,
        //     direct: $scope.directUser,
        //     user: $scope.handle,
        //     data: $scope.messageText,
        //     time: Symple.formatTime(new Date)
        // });
        $scope.messageText = "";
        var box = $('#messagesList');
        box.scrollTop = box.scrollHeight;
    };

    // Login
    $scope.login = function() {

        console.log($scope.account[$scope.email])
        $scope.handle = $scope.account[$scope.email]
        console.log($scope.handle)
        if (!$scope.handle || $scope.handle.length < 3) {
            alert('Check email and password.');
            return;
        }

        $scope.client.options.peer.user = $scope.handle;


        console.log('directUser:', $scope.client.options.peer.user)
        $scope.client.connect();
        $scope.isLoading = true;
        $scope.isLogined= true;
        //$scope.$apply();
    }


    //
    // Video

    $scope.startVideoCall = function(user) {
        if (assertGetUserMedia()) {
            console.log('startVideoCall', user)
            $scope.hideCamera = false;
            if (user == $scope.handle) {
                alert('Cannot video chat with yourself. Please open a new browser window and login with a different handle.');
                return;
            }

            $scope.client.sendCommand({
                node: 'call:init',
                to: user
            })
        }
    }

    $scope.startLocalVideo = function() {
        if (assertGetUserMedia()) {
            // Init local video localPlayer
            $scope.localPlayer = createPlayer($scope, 'caller', '#video .local-video');
            $scope.localPlayer.play({ localMedia: true, disableAudio: $scope.disableLocalAudio });

            // TODO: Set false on session end or Symple error
            $scope.localVideoPlaying = true;
        }
    }

    $scope.endCallVideo = function() {
        $scope.hideCamera = true;
        $scope.localVideoPlaying = false;
    }

    //
    // Helpers

    $scope.isLoggedIn = function() {
        return $scope.handle != null && $scope.client.online();
    }

    
    $scope.getMessageClass = function(m) {
        // if (m.direct)
        //     return 'list-group-item-warning';
        // return '';
        if(m.user == $scope.handle) {
            return 'row message-bubble'
        }
        return 'row message-bubble-2'
    }


    function remove(arr, item) {
      for(var i = arr.length; i--;) {
          if(arr[i] === item) {
              arr.splice(i, 1);
          }
      }
    }

    function showCamera(showed) {
        if (showed) {
            angular.element(document.querySelector('#camera'))[0].style.height = "300px";
        } else {
            angular.element(document.querySelector('#camera'))[0].style.height = "0px";
        }
    }

}
