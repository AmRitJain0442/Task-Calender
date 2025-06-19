const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://your-username:your-password@cluster0.xxxxx.mongodb.net/calendar_app?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Todo Item Schema
const todoItemSchema = new mongoose.Schema({
  text: { type: String, required: true },
  completed: { type: Boolean, default: false },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  dueDate: { type: Date },
  notes: { type: String, default: '' }
}, { timestamps: true });

// Todo List Schema
const todoListSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  color: { type: String, default: '#007bff' },
  items: [todoItemSchema],
  status: {
    type: String,
    enum: ['active', 'completed', 'archived'],
    default: 'active'
  }
}, { timestamps: true });

// Enhanced Event Schema with todo list mapping
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
  // NEW: Link to todo lists
  todoLists: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'TodoList' 
  }],
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

// Models
const Event = mongoose.model('Event', eventSchema);
const TodoList = mongoose.model('TodoList', todoListSchema);

// ================================
// EVENT ROUTES (existing + enhanced)
// ================================

// Get all events (with todo lists populated)
app.get('/api/events', async (req, res) => {
  try {
    const events = await Event.find({ status: { $ne: 'cancelled' } })
                              .populate('todoLists');
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single event (with todo lists)
app.get('/api/events/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('todoLists');
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
    
    // Populate todo lists if any were assigned
    await event.populate('todoLists');
    
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
    ).populate('todoLists');
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(event);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete an event
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

// Assign todo list to event
app.post('/api/events/:eventId/assign-list/:listId', async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    const todoList = await TodoList.findById(req.params.listId);
    
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!todoList) return res.status(404).json({ error: 'Todo list not found' });
    
    if (!event.todoLists.includes(req.params.listId)) {
      event.todoLists.push(req.params.listId);
      await event.save();
    }
    
    await event.populate('todoLists');
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove todo list from event
app.delete('/api/events/:eventId/remove-list/:listId', async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    event.todoLists = event.todoLists.filter(id => id.toString() !== req.params.listId);
    await event.save();
    
    await event.populate('todoLists');
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================================
// TODO LIST ROUTES
// ================================

// Get all todo lists
app.get('/api/todolists', async (req, res) => {
  try {
    const lists = await TodoList.find({ status: { $ne: 'archived' } });
    res.json(lists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single todo list
app.get('/api/todolists/:id', async (req, res) => {
  try {
    const list = await TodoList.findById(req.params.id);
    if (!list) {
      return res.status(404).json({ error: 'Todo list not found' });
    }
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new todo list
app.post('/api/todolists', async (req, res) => {
  try {
    const todoList = new TodoList(req.body);
    await todoList.save();
    res.status(201).json(todoList);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update a todo list
app.put('/api/todolists/:id', async (req, res) => {
  try {
    const list = await TodoList.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!list) {
      return res.status(404).json({ error: 'Todo list not found' });
    }
    
    res.json(list);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a todo list
app.delete('/api/todolists/:id', async (req, res) => {
  try {
    const list = await TodoList.findByIdAndUpdate(
      req.params.id,
      { status: 'archived' },
      { new: true }
    );
    
    if (!list) {
      return res.status(404).json({ error: 'Todo list not found' });
    }
    
    res.json({ message: 'Todo list archived successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================================
// TODO ITEM ROUTES
// ================================

// Add item to todo list
app.post('/api/todolists/:listId/items', async (req, res) => {
  try {
    const list = await TodoList.findById(req.params.listId);
    if (!list) {
      return res.status(404).json({ error: 'Todo list not found' });
    }
    
    list.items.push(req.body);
    await list.save();
    
    res.status(201).json(list);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add multiple items to todo list
app.post('/api/todolists/:listId/items/bulk', async (req, res) => {
  try {
    const list = await TodoList.findById(req.params.listId);
    if (!list) {
      return res.status(404).json({ error: 'Todo list not found' });
    }
    
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items must be an array' });
    }
    
    list.items.push(...items);
    await list.save();
    
    res.status(201).json(list);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update a todo item
app.put('/api/todolists/:listId/items/:itemId', async (req, res) => {
  try {
    const list = await TodoList.findById(req.params.listId);
    if (!list) {
      return res.status(404).json({ error: 'Todo list not found' });
    }
    
    const item = list.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ error: 'Todo item not found' });
    }
    
    Object.assign(item, req.body);
    await list.save();
    
    res.json(list);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a todo item
app.delete('/api/todolists/:listId/items/:itemId', async (req, res) => {
  try {
    const list = await TodoList.findById(req.params.listId);
    if (!list) {
      return res.status(404).json({ error: 'Todo list not found' });
    }
    
    list.items.id(req.params.itemId).remove();
    await list.save();
    
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle todo item completion
app.patch('/api/todolists/:listId/items/:itemId/toggle', async (req, res) => {
  try {
    const list = await TodoList.findById(req.params.listId);
    if (!list) {
      return res.status(404).json({ error: 'Todo list not found' });
    }
    
    const item = list.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ error: 'Todo item not found' });
    }
    
    item.completed = !item.completed;
    await list.save();
    
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================================
// SEARCH ROUTES
// ================================

// Search across events and todo lists
app.get('/api/search', async (req, res) => {
  try {
    const { q: query, type } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const searchRegex = new RegExp(query, 'i');
    const results = {};
    
    if (!type || type === 'events') {
      const events = await Event.find({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { location: searchRegex }
        ],
        status: { $ne: 'cancelled' }
      }).populate('todoLists');
      
      results.events = events;
    }
    
    if (!type || type === 'todolists') {
      const todoLists = await TodoList.find({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { 'items.text': searchRegex }
        ],
        status: { $ne: 'archived' }
      });
      
      results.todoLists = todoLists;
    }
    
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Enhanced Calendar & Todo Server running on http://localhost:${PORT}`);
});