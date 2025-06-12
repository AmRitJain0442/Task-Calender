const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB connection
// Option 1: Use MongoDB Atlas (cloud) - Replace with your connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://your-username:your-password@cluster0.xxxxx.mongodb.net/calendar_app?retryWrites=true&w=majority';

// Option 2: Use local MongoDB
// const MONGODB_URI = 'mongodb://localhost:27017/calendar_app';
//i think apna compass la string works but other wont be able to read it 

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Event Schema , this is what we decided on , jo optional h uska either default empty string kardo ya fir set default false 
const eventSchema = new mongoose.Schema({
  calendarId: { type: mongoose.Schema.Types.ObjectId, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  location: { type: String, default: '' },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  isAllDay: { type: Boolean, default: false },
  recurrenceRule: { type: String, default: null },
  status: { 
    type: String, 
    enum: ['confirmed', 'tentative', 'cancelled'],
    default: 'confirmed'
  },
  attendees: [{
    userId: mongoose.Schema.Types.ObjectId,
    status: {
      type: String,
      enum: ['accepted', 'declined', 'needs_action'],
      default: 'needs_action'
    },
    isOrganizer: { type: Boolean, default: false }
  }]
}, { timestamps: true });

//load mongoose 
const Event = mongoose.model('Event', eventSchema);

// Routes

// Get all events
app.get('/api/events', async (req, res) => {
  try {
    const events = await Event.find({ status: { $ne: 'cancelled' } });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single event
app.get('/api/events/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new event
app.post('/api/events', async (req, res) => {
  try {
    // For simplicity, using hardcoded IDs. In real app, get from auth
    const eventData = {
      ...req.body,
      calendarId: new mongoose.Types.ObjectId(),
      ownerId: new mongoose.Types.ObjectId(),
      attendees: [{
        userId: new mongoose.Types.ObjectId(),
        status: 'accepted',
        isOrganizer: true
      }]
    };
    
    const event = new Event(eventData);
    await event.save();
    res.status(201).json(event);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update an event
app.put('/api/events/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(event);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete an event (soft delete by setting status to cancelled)
app.delete('/api/events/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled' },
      { new: true }
    );
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ message: 'Event cancelled successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});