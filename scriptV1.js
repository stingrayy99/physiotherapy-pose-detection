let video;
let poseNet;
let poses = [];
let tracking = false;

function setup() {
    video = document.getElementById("video");  // Get the video element
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    // Set canvas size to match video size
    canvas.width = 640;
    canvas.height = 480;

    console.log("Setting up PoseNet...");

    // Load ml5 PoseNet model
    poseNet = ml5.poseNet(video, modelLoaded);
    poseNet.on("pose", (results) => {
        if (results.length === 0) {
            console.log("No poses detected");
        } else {
            poses = results;
            drawKeypoints(ctx, poses);  // Draw keypoints on the canvas
            drawSkeleton(poses, ctx);   // Optional: Draw skeleton lines for visualization
            if (tracking) trackShoulderWings();  // Track shoulder wings exercise if tracking
        }
    });

    // Start video stream after setup
    startVideo();
}

// Ensure video loads properly
function startVideo() {
    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then((stream) => {
                video.srcObject = stream;
                video.play();
                console.log("Video stream started.");
            })
            .catch((err) => console.error("Error accessing webcam:", err));
    } else {
        alert("Your browser does not support webcam access.");
    }
}

// Model loaded
function modelLoaded() {
    console.log("PoseNet model loaded!");
}

// Draw keypoints on canvas
function drawKeypoints(ctx, poses) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);  // Clear the canvas each frame
    ctx.drawImage(video, 0, 0, ctx.canvas.width, ctx.canvas.height);  // Draw video frame

    poses.forEach((pose) => {
        pose.pose.keypoints.forEach((keypoint) => {
            if (keypoint.score > 0.6) {  // Only draw keypoints with confidence score above 0.6
                ctx.fillStyle = "red";  // Set the color for keypoints
                ctx.beginPath();
                ctx.arc(keypoint.position.x, keypoint.position.y, 5, 0, 2 * Math.PI);  // Draw circle
                ctx.fill();
            }
        });
    });
}

// Draw skeleton on canvas (optional, for visualization)
function drawSkeleton(poses, ctx) {
    poses.forEach((pose) => {
        const skeleton = pose.skeleton;
        skeleton.forEach((bone) => {
            ctx.beginPath();
            ctx.moveTo(bone[0].position.x, bone[0].position.y);
            ctx.lineTo(bone[1].position.x, bone[1].position.y);
            ctx.strokeStyle = "blue";
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    });
}

// Demo Video Controls
document.addEventListener('DOMContentLoaded', function() {
    const demoButton = document.getElementById('demoButton');
    const closeDemoButton = document.getElementById('closeDemoButton');
    const demoVideoContainer = document.getElementById('demoVideoContainer');
    const demoVideo = document.getElementById('demoVideo');
    
    // Replace with your actual demo video URL
    demoVideo.src = "/demoVideos/shoulderWings.mp4";
    
    demoButton.addEventListener('click', function() {
      demoVideoContainer.classList.remove('demo-hidden');
      demoVideo.currentTime = 0;
      demoVideo.play().catch(e => console.log("Video play error:", e));
    });
    
    closeDemoButton.addEventListener('click', function() {
      demoVideoContainer.classList.add('demo-hidden');
      demoVideo.pause();
    });
    
    // Also close when clicking outside video
    demoVideoContainer.addEventListener('click', function(e) {
      if (e.target === demoVideoContainer) {
        demoVideoContainer.classList.add('demo-hidden');
        demoVideo.pause();
      }
    });
  });

// Shoulder wings exercise tracking
let shoulderWingsReps = 0;
let targetReps = 0;
let inRep = false;
let lastRepTime = 0;
let trackingStartTime = 0;

function startShoulderWings() {
    targetReps = parseInt(document.getElementById('targetReps').value) || 0;

    if (targetReps <= 0) {
        alert('Please enter a valid number for target reps');
        return;
    }

    shoulderWingsReps = 0;
    inRep = false;
    document.getElementById('trackingStatus').innerText = 'Tracking...';
    document.getElementById('repCount').innerText = `Reps: 0 / ${targetReps}`;
    document.getElementById('exerciseStatus').innerText = '';  // Clear exercise status
    document.getElementById('trackingStatus').style.display = 'block'; // Show tracking text

    tracking = true;  // Enable tracking
    document.getElementById('startButton').disabled = true;  // Disable button while tracking
    trackingStartTime = Date.now(); 
}

// Function to track shoulder wings reps based on pose data
function trackShoulderWings() {
    if (poses.length > 0) {
        const pose = poses[0].pose;  // Get the first pose (if there are multiple)
        const currentTime = Date.now();
        if (currentTime - trackingStartTime < 1000) {
            return; // ignore detections in first second
        }

        const leftShoulder = pose.keypoints.find(point => point.part === 'leftShoulder');
        const rightShoulder = pose.keypoints.find(point => point.part === 'rightShoulder');
        const leftElbow = pose.keypoints.find(point => point.part === 'leftElbow');
        const rightElbow = pose.keypoints.find(point => point.part === 'rightElbow');

        if (leftShoulder && rightShoulder && leftElbow && rightElbow) {
            // Calculate distances between keypoints to track arm movement
            const shoulderDistance = Math.sqrt(Math.pow(rightShoulder.position.x - leftShoulder.position.x, 2) +
                Math.pow(rightShoulder.position.y - leftShoulder.position.y, 2));
            const leftElbowToShoulderDistance = Math.sqrt(Math.pow(leftElbow.position.x - leftShoulder.position.x, 2) +
                Math.pow(leftElbow.position.y - leftShoulder.position.y, 2));
            const rightElbowToShoulderDistance = Math.sqrt(Math.pow(rightElbow.position.x - rightShoulder.position.x, 2) +
                Math.pow(rightElbow.position.y - rightShoulder.position.y, 2));

            // Define thresholds to detect when a rep is completed (arms spread out)
            const spreadThreshold = 150;  // Minimum distance between shoulders for a rep
            const elbowThreshold = 100;   // Elbow distance from the shoulder for a valid rep

            if (shoulderDistance > spreadThreshold &&
                leftElbowToShoulderDistance > elbowThreshold &&
                rightElbowToShoulderDistance > elbowThreshold &&
                (currentTime - lastRepTime > 1000)) {

                // Ensure we only count a rep once
                if (!inRep) {
                    shoulderWingsReps++;
                    inRep = true;
                    lastRepTime = currentTime; // reset lastRepTime to current time
                    document.getElementById('repCount').innerText = `Reps: ${shoulderWingsReps} / ${targetReps}`;
                }
            } else if (shoulderDistance < spreadThreshold * 0.7) {
                inRep = false;  // Reset rep tracking if arms are not spread out enough
            }
        

            // Check if exercise is completed
            if (shoulderWingsReps >= targetReps) {
                tracking = false;
                document.getElementById('trackingStatus').style.display = 'none';
                document.getElementById('exerciseStatus').innerText = 'Exercise Completed!';
                document.getElementById('startButton').disabled = false;  // Re-enable button for next round
            }
        }
    }
}

// Event listener for Start Button
document.getElementById('startButton').addEventListener('click', startShoulderWings);

setup();
