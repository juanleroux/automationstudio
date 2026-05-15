using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;
using gTools.Log;
using System.Collections;
using System.Collections.ObjectModel;
using System.Reflection;
using System.Globalization;
using System.IO;
using System.Text.RegularExpressions;
using System.Windows.Threading;
using System.Windows.Markup;

namespace TagCreator
{
    /// <summary>
    /// Interaction logic for AttributesControl.xaml
    /// </summary>
    public partial class ProfileAttributesControl : UserControl, INotifyPropertyChanged                                                                                                                                                                                                      
    {
        #region Initialization

        public event PropertyChangedEventHandler PropertyChanged;
        
        private Profile _profile;        
        private ProfileAttribute _currentAttribute;
        private string[] _templateAttributesKeywords;
        private string[] _profileAttributesKeywords;
        private List<RichTextBoxTag> _richTextBoxTags = new List<RichTextBoxTag>();
        private DispatcherTimer _richTextBoxTimer = new DispatcherTimer();
        private Point _dragDropStartPosition;

        private struct RichTextBoxTag
        {
            public TextPointer StartPosition;
            public TextPointer EndPosition;
            public bool IsMulti;
            public string Text;
        }

        // Build a single tabular CSV line for one instance using this control's ParentProxy.CurrentTemplate
        public string BuildTabularLine(Profile profile, Instance instance, string delimiter)
        {
            try
            {
                // copy properties from template to instance (name, desc, data type)
                foreach (AttributeBase attribute in ParentProxy.CurrentTemplate.Attributes.Items)
                    instance.Attributes.Items.Where(u => u.Id == attribute.Id).Single().GetParentsProperties(attribute);

                // create values based on attribute's rules
                StringBuilder line = new StringBuilder();
                foreach (ProfileAttribute attribute in profile.Attributes.Items.OrderBy(u => u.Id))
                {
                    if (AddAttributeValue_String(attribute, instance, line, delimiter) == false)
                        return null;

                    if (AddAttributeValue_Number(attribute, instance, line, delimiter) == false)
                        return null;

                    if (AddAttributeValue_Boolean(attribute, instance, line, delimiter) == false)
                        return null;
                }

                return line.ToString();
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
                return null;
            }
        }

        // Build a structural export fragment for a single instance by delegating to ExportStructuralProfile into a temp file
        public string BuildStructuralForInstance(Profile profile, Instance instance)
        {
            string tmp = null;
            try
            {
                tmp = System.IO.Path.GetTempFileName();
                ExportStructuralProfile(profile, instance, tmp);
                string content = File.ReadAllText(tmp);
                return content;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
                return null;
            }
            finally
            {
                try { if (tmp != null && File.Exists(tmp)) File.Delete(tmp); } catch { }
            }
        }

        // New: export for multiple selected instances (merged into single tabular file)
        public void ExportTabularProfile(Profile profile, List<Instance> selectedInstances, string filePath)
        {
            try
            {
                using (StreamWriter writer = new StreamWriter(filePath))
                {
                    StringBuilder line = new StringBuilder();

                    //write header
                    foreach (ProfileAttribute attribute in profile.Attributes.Items.OrderBy(u => u.Id))
                    {
                        //parse rule text
                        string errorMessage = string.Empty;
                        if (attribute.VerifyRule(ParentProxy.CurrentTemplate.Attributes.Items, ref errorMessage, attribute.Rule, 0, "+") == false)
                        {
                            MainWindow.ShowMessage(errorMessage.Insert(0, attribute.Name + ": "));
                            return;
                        }

                        line.Append(attribute.Name).Append(profile.TabularExportDelimiter);
                    }

                    writer.WriteLine(line);

                    //write rows for selected instances only
                    foreach (Instance instance in selectedInstances)
                    {
                        //copy properties from template to instance (name, desc, data type)
                        foreach (AttributeBase attribute in ParentProxy.CurrentTemplate.Attributes.Items)
                            instance.Attributes.Items.Where(u => u.Id == attribute.Id).Single().GetParentsProperties(attribute);

                        //create values based on attribute's rules
                        line = new StringBuilder();
                        foreach (ProfileAttribute attribute in profile.Attributes.Items.OrderBy(u => u.Id))
                        {
                            if (AddAttributeValue_String(attribute, instance, line, profile.TabularExportDelimiter) == false)
                                return;

                            if (AddAttributeValue_Number(attribute, instance, line, profile.TabularExportDelimiter) == false)
                                return;

                            if (AddAttributeValue_Boolean(attribute, instance, line, profile.TabularExportDelimiter) == false)
                                return;
                        }

                        writer.WriteLine(line);
                    }

                    writer.Close();
                }
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }
        
        public ProfileAttributesControl()
        {
            InitializeComponent();

            this.DataContext = this;

            _richTextBox.Language = XmlLanguage.GetLanguage(CultureInfo.CurrentCulture.IetfLanguageTag);
            _richTextBoxTimer.Interval = TimeSpan.FromMilliseconds(100);
            _richTextBoxTimer.Tick += _richTextBoxTimer_Tick;
        }

        
        #endregion

        #region Properties

        public EngineeringParentProxy ParentProxy
        {
            get;
            set;
        }

        public MainWindow MainWindow
        {
            get;
            set;            
        }

        public Project Project
        {
            get;
            set;
        }
        
        public Profile Profile
        {
            get
            {
                return _profile;
            }
            set
            {
                _profile = value;
                _dataGrid.ItemsSource = _profile.Attributes.Items;
            }
        }
       
        #endregion

        #region Data Binding

        public ProfileAttribute CurrentAttribute
        {
            get
            {
                return _currentAttribute;
            }
            set
            {
                _currentAttribute = value;
                NotifyPropertyChanged("CurrentAttribute");
                NotifyPropertyChanged("IsDataGridSelection");
            }
        }

        public bool IsDataGridSelection
        {
            get
            {
                return _currentAttribute != null;
            }
        }

        #endregion

        #region Events

        private void AddAttributeButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                ProfileAttribute attribute = new ProfileAttribute();
                attribute.Id = ParentProxy.CurrentProfile.Attributes.GetNextId();

                ParentProxy.CurrentTemplate.AddProfileAttribute(ParentProxy.CurrentProfile, attribute);
                
                ShowEditWindow(attribute);     
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }
        /*
        private void DeleteAttributeButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (MainWindow.Confirm("Are you sure that you want to delete attribute {0}?", _currentAttribute.Name) != true)
                    return;

                ParentProxy.CurrentTemplate.RemoveProfileAttribute(ParentProxy.CurrentProfile, _currentAttribute);                
                LoadRichTextBoxDocument();
                ParentProxy.NotifyPropertyChanged("TemplateLastModification");
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }
        */
        private void ReassignIds(ObservableCollection<ProfileAttribute> attributes)
        {
            // Sort attributes by their current ID (if needed)
            var sortedAttributes = attributes.OrderBy(a => a.Id).ToList();

            // Reassign IDs sequentially starting from 1
            for (int i = 0; i < sortedAttributes.Count; i++)
            {
                sortedAttributes[i].Id = i + 1;
            }

            // Refresh the DataGrid to show the updated IDs
            ApplyDataGridSorting();
        }

        private void DeleteAttributeButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (MainWindow.Confirm("Are you sure that you want to delPA attribute {0}?", _currentAttribute.Name) != true)
                    return;

                // Remove the selected attribute
                ParentProxy.CurrentTemplate.RemoveProfileAttribute(ParentProxy.CurrentProfile, _currentAttribute);

                // Reassign IDs of remaining attributes in a consecutive manner
                ReassignIds(ParentProxy.CurrentProfile.Attributes.Items);

                // Reload the document in the RichTextBox
                LoadRichTextBoxDocument();

                // Notify that the template's last modification has changed
                ParentProxy.NotifyPropertyChanged("TemplateLastModification");
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void DuplicateAttributeButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                ProfileAttribute attribute = new ProfileAttribute(_currentAttribute);
                attribute.Id = ParentProxy.CurrentProfile.Attributes.GetNextId();
                ParentProxy.CurrentTemplate.AddProfileAttribute(ParentProxy.CurrentProfile, attribute);                

                ShowEditWindow(attribute);
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void _dataGrid_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            CurrentAttribute = (ProfileAttribute)_dataGrid.SelectedItem;
        }

        private void _dataGrid_MouseRightButtonUp(object sender, MouseButtonEventArgs e)
        {
            try
            {
                //get DataGridRow object
                DependencyObject obj = (DependencyObject)e.OriginalSource;
                while (obj != null && (obj is DataGridRow) == false)
                    obj = VisualTreeHelper.GetParent(obj);

                if (obj == null)
                    return;

                //get connected attribute
                ProfileAttribute attribute = (ProfileAttribute)_dataGrid.ItemContainerGenerator.ItemFromContainer(obj as DataGridRow);

                ShowEditWindow(attribute);
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        void _richTextBoxTimer_Tick(object sender, EventArgs e)
        {
            _richTextBoxTimer.Stop();
            //Console.WriteLine(DateTime.Now);

            try
            {
                _richTextBox.TextChanged -= _richTextBox_TextChanged;

                //clear highlighting
                TextRange documentRange = new TextRange(_richTextBox.Document.ContentStart, _richTextBox.Document.ContentEnd);
                documentRange.ClearAllProperties();
                _richTextBoxTags.Clear();

                //create navigator to go through text, find all keywords but do not hightlight
                TextPointer navigator = _richTextBox.Document.ContentStart;
                while (navigator.CompareTo(_richTextBox.Document.ContentEnd) < 0)
                {
                    TextPointerContext context = navigator.GetPointerContext(LogicalDirection.Backward);
                    if (context == TextPointerContext.ElementStart && navigator.Parent is Run)
                    {
                        string text = ((Run)navigator.Parent).Text;
                        if (string.IsNullOrEmpty(text) == false)
                        {
                            //find Template/Instance properties
                            string[] keywords = new string[] { "Template.Id", "Template.Name", "Template.Description", "Instance.Id", "Instance.Name", "Instance.Description", "Instance.Flagged", "Instance.AreaName", "Instance.AreaDescription" };
                            CheckWordsInRun((Run)navigator.Parent, text, keywords);

                            //find Client properties
                            keywords = new string[] { "Client.CompanyName", "Client.ContactName", "Client.Phone", "Client.Email", "Client.Address", "Client.Tax" };
                            CheckWordsInRun((Run)navigator.Parent, text, keywords);

                            //find Proposal properties
                            keywords = new string[] { "Proposal.Name", "Proposal.Description" };
                            CheckWordsInRun((Run)navigator.Parent, text, keywords);

                            //find Company  properties
                            keywords = new string[] { "Company.CompanyName", "Company.ContactName", "Company.Phone", "Company.Email", "Company.Address", "Company.Tax" };
                            CheckWordsInRun((Run)navigator.Parent, text, keywords);
                            
                            //find Template attributes properties                       
                            CheckWordsInRun((Run)navigator.Parent, text, _templateAttributesKeywords);

                            //find Profile attributes properties                       
                            CheckWordsInRun((Run)navigator.Parent, text, _profileAttributesKeywords);

                            //find multiline                                                
                            keywords = new string[] { "%%MULTI%%", "%%ENDMULTI%%" };
                            CheckWordsInRun((Run)navigator.Parent, text, keywords, true);
                        }
                    }

                    navigator = navigator.GetNextContextPosition(LogicalDirection.Forward);
                }

                //highlight found keywords
                foreach (var tag in _richTextBoxTags)
                {
                    TextRange range = new TextRange(tag.StartPosition, tag.EndPosition);

                    if (tag.IsMulti == false)
                        range.ApplyPropertyValue(TextElement.FontWeightProperty, FontWeights.Bold);
                    else
                        range.ApplyPropertyValue(TextElement.BackgroundProperty, new SolidColorBrush(Colors.Yellow));
                }
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
            finally
            {
                _richTextBox.TextChanged += _richTextBox_TextChanged;
            }
        }

        private void _richTextBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (_profile.ExportType == ProfileExportTypes.Tabular)
                return;

            _richTextBoxTimer.Stop();

            //save current text to variable, start syntax highlighting timer     
            string text = new TextRange(_richTextBox.Document.ContentStart, _richTextBox.Document.ContentEnd).Text;
            if (text.Equals(_profile.StructuralExportTemplate, StringComparison.OrdinalIgnoreCase) == false)
            {
                _profile.StructuralExportTemplate = text;
                _richTextBoxTimer.Start();
            }
        }

        private void UserControl_Loaded(object sender, RoutedEventArgs e)
        {
            LoadRichTextBoxDocument();
        }

        private void ContextMenuButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                //create context menu
                ContextMenu menu = new ContextMenu();                
                MenuItem menuItem = new MenuItem() { Header = "Export profile" };
                menuItem.Click += ExportProfileMenuItem_Click;
                menu.Items.Add(menuItem);

                menu.IsOpen = true;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }
        
        private void ExportProfileMenuItem_Click(object sender, RoutedEventArgs e)
        {
            ParentProxy.ExportProfile(_profile);
        }

        private void _dataGrid_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            _dragDropStartPosition = e.GetPosition(null);
        }

        private void _dataGrid_PreviewMouseMove(object sender, MouseEventArgs e)
        {
            Vector difference = _dragDropStartPosition - e.GetPosition(null);

            if (e.LeftButton == MouseButtonState.Released)
                return;

            if (Math.Abs(difference.X) < SystemParameters.MinimumHorizontalDragDistance && Math.Abs(difference.Y) < SystemParameters.MinimumVerticalDragDistance)
                return;

            //get DataGridRow object
            DependencyObject obj = (DependencyObject)e.OriginalSource;
            while (obj != null && (obj is DataGridRow) == false)
                obj = VisualTreeHelper.GetParent(obj);

            if (obj == null)
                return;

            //get connected attribute
            ProfileAttribute attribute = (ProfileAttribute)_dataGrid.ItemContainerGenerator.ItemFromContainer(obj as DataGridRow);

            //Initialize drag & drop object
            DataObject dragData = new DataObject("ProfileAttribute", attribute);
            DragDrop.DoDragDrop(_dataGrid, dragData, DragDropEffects.Move);
        }

        private void _dataGrid_DragEnter(object sender, DragEventArgs e)
        {
            if (e.Data.GetDataPresent("ProfileAttribute") == false)
            {
                e.Effects = DragDropEffects.None;
                e.Handled = true;
            }
        }

        private void _dataGrid_DragOver(object sender, DragEventArgs e)
        {
            if (e.Data.GetDataPresent("ProfileAttribute") == false)
            {
                e.Effects = DragDropEffects.None;
                e.Handled = true;
            }
        }

        private void _dataGrid_Drop(object sender, DragEventArgs e)
        {
            if (e.Data.GetDataPresent("ProfileAttribute") == false)
                return;

            //get DataGridRow object
            DependencyObject obj = (DependencyObject)e.OriginalSource;
            while (obj != null && (obj is DataGridRow) == false)
                obj = VisualTreeHelper.GetParent(obj);

            if (obj == null)
                return;

            //get connected attribute
            ProfileAttribute currentAttribute = (ProfileAttribute)_dataGrid.ItemContainerGenerator.ItemFromContainer(obj as DataGridRow);
            ProfileAttribute movedAttribute = e.Data.GetData("ProfileAttribute") as ProfileAttribute;

            //Replace items id
            int tempId = movedAttribute.Id;
            movedAttribute.Id = currentAttribute.Id;
            currentAttribute.Id = tempId;

            //Refresh
            ApplyDataGridSorting();

            //refresh tabular preview
            if (_profile.ExportType == ProfileExportTypes.Tabular)
                LoadRichTextBoxDocument();

            //Bring back keyboard focus
            DataGridRow row = (DataGridRow)_dataGrid.ItemContainerGenerator.ContainerFromIndex(_dataGrid.SelectedIndex);
            row.MoveFocus(new TraversalRequest(FocusNavigationDirection.Next));

            ParentProxy.NotifyPropertyChanged("TemplateLastModification");
        }

        private void DescriptionTextBlock_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ClickCount <= 1)
                return;

            _descriptionEditTextBox.Visibility = System.Windows.Visibility.Visible;
            _descriptionEditTextBox.Focus();
        }

        private void _descriptionEditTextBox_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                _descriptionEditTextBox.Visibility = System.Windows.Visibility.Hidden;
                Keyboard.ClearFocus();
            }
        }

        private void _descriptionEditTextBox_LostFocus(object sender, RoutedEventArgs e)
        {
            _descriptionEditTextBox.Visibility = System.Windows.Visibility.Hidden;
        }

        #endregion

        #region Methods

        /// <summary>
        /// WPF data change notification
        /// </summary>
        /// <param name="property"></param>
        public void NotifyPropertyChanged(String property)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(property));
            }
        }

        public void ApplyDataGridSorting()
        {
            //sort datagrid by name
            _dataGrid.Columns[0].SortDirection = ListSortDirection.Ascending;
            _dataGrid.Items.SortDescriptions.Clear();
            _dataGrid.Items.SortDescriptions.Add(new SortDescription("Id", ListSortDirection.Ascending));
            _dataGrid.UpdateLayout();            
        }

        public void MakeDataGridSelection()
        {
            if (_dataGrid.SelectedIndex >= 0)
                return;

            _dataGrid.SelectedIndex = 0;
            CurrentAttribute = (ProfileAttribute)_dataGrid.SelectedItem;
        }

        private void ShowEditWindow(ProfileAttribute attribute)
        {
            _dataGrid.SelectedItem = attribute;

            ProfileAttributeWindow window = new ProfileAttributeWindow() { Owner = MainWindow, CurrentAttribute = attribute, ParentProxy = ParentProxy, MainWindow = MainWindow };
            window.ShowDialog();

            ApplyDataGridSorting();
            _dataGrid.SelectedItem = window.CurrentAttribute;
            LoadRichTextBoxDocument();
            ParentProxy.NotifyPropertyChanged("TemplateLastModification");
        }

        public void ExportTabularProfile(Profile profile, Instance selectedInstance, string filePath)
        {
            try
            {
                using (StreamWriter writer = new StreamWriter(filePath))
                {
                    StringBuilder line = new StringBuilder();

                    //write header
                    foreach (ProfileAttribute attribute in profile.Attributes.Items.OrderBy(u => u.Id))
                    {
                        //parse rule text
                        string errorMessage = string.Empty;
                        if (attribute.VerifyRule(ParentProxy.CurrentTemplate.Attributes.Items, ref errorMessage, attribute.Rule, 0, "+") == false)
                        {
                            MainWindow.ShowMessage(errorMessage.Insert(0, attribute.Name + ": "));
                            return;
                        }

                        line.Append(attribute.Name).Append(profile.TabularExportDelimiter);
                    }

                    writer.WriteLine(line);

                    //write rows
                    foreach (Instance instance in (selectedInstance != null) ? ParentProxy.CurrentTemplate.Instances.Items.Where(u => u == selectedInstance) : ParentProxy.CurrentTemplate.Instances.Items)
                    {
                        //copy properties from template to instance (name, desc, data type)
                        foreach (AttributeBase attribute in ParentProxy.CurrentTemplate.Attributes.Items)
                            instance.Attributes.Items.Where(u => u.Id == attribute.Id).Single().GetParentsProperties(attribute);

                        //create values based on attribute's rules
                        line = new StringBuilder();
                        foreach (ProfileAttribute attribute in profile.Attributes.Items.OrderBy(u => u.Id))
                        {
                            if (AddAttributeValue_String(attribute, instance, line, profile.TabularExportDelimiter) == false)
                                return;

                            if (AddAttributeValue_Number(attribute, instance, line, profile.TabularExportDelimiter) == false)
                                return;

                            if (AddAttributeValue_Boolean(attribute, instance, line, profile.TabularExportDelimiter) == false)
                                return;
                        }

                        writer.WriteLine(line);
                    }

                    writer.Close();
                }
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        public void ExportStructuralProfile(Profile profile, Instance selectedInstance, string filePath)
        {
            try
            {
                using (StreamWriter writer = new StreamWriter(filePath))
                {
                    StringBuilder output = new StringBuilder(profile.StructuralExportTemplate);

                    //first pass - replace tags with unique tags (in case output value is same as input one for next replacement)
                    //replace Template properties
                    string[] searchItems = new string[] { "Template.Id", "Template.Name", "Template.Description" };
                    string[] replaceItems = new string[] { "%%TEMPLATE_ID%%", "%%TEMPLATE_NAME%%", "%%TEMPLATE_DESCRIPTION%%" };
                    for (int i = 0; i < searchItems.Length; i++)
                        FindAndReplace(output, searchItems[i], replaceItems[i]);

                    //replace Instance properties
                    searchItems = new string[] { "Instance.Id", "Instance.Name", "Instance.Description", "Instance.Flagged", "Instance.AreaName", "Instance.AreaDescription" };
                    replaceItems = new string[] { "%%INSTANCE_ID%%", "%%INSTANCE_NAME%%", "%%INSTANCE_DESCRIPTION%%", "%%INSTANCE_FLAGGED%%", "%%INSTANCE_AREA_NAME%%", "%%INSTANCE_AREA_DESCRIPTION%%" };
                    for (int i = 0; i < searchItems.Length; i++)
                        FindAndReplace(output, searchItems[i], replaceItems[i]);

                    //replace Client properties
                    searchItems = new string[] { "Client.CompanyName", "Client.ContactName", "Client.Phone", "Client.Email", "Client.Address", "Client.Tax" };
                    replaceItems = new string[] { "%%CLIENT_COMPANY_NAME%%", "%%CLIENT_CONTACT_NAME%%", "%%CLIENT_PHONE%%", "%%CLIENT_EMAIL%%", "%%CLIENT_ADDRESS%%", "%%CLIENT_TAX%%" };
                    for (int i = 0; i < searchItems.Length; i++)
                        FindAndReplace(output, searchItems[i], replaceItems[i]);

                    //replace Proposal properties
                    searchItems = new string[] { "Proposal.Name", "Proposal.Description" };
                    replaceItems = new string[] { "%%PROPOSAL_NAME%%", "%%PROPOSAL_DESCRIPTION%%" };
                    for (int i = 0; i < searchItems.Length; i++)
                        FindAndReplace(output, searchItems[i], replaceItems[i]);

                    //replace Company properties
                    searchItems = new string[] { "Company.CompanyName", "Company.ContactName", "Company.Phone", "Company.Email", "Company.Address", "Company.Tax" };
                    replaceItems = new string[] { "%%COMPANY_COMPANY_NAME%%", "%%COMPANY_CONTACT_NAME%%", "%%COMPANY_PHONE%%", "%%COMPANY_EMAIL%%", "%%COMPANY_ADDRESS%%", "%%COMPANY_TAX%%" };
                    for (int i = 0; i < searchItems.Length; i++)
                        FindAndReplace(output, searchItems[i], replaceItems[i]);
                   
                    //replace Template attributes properties
                    foreach (TemplateAttribute attribute in ParentProxy.CurrentTemplate.Attributes.Items)
                    {
                        var properties = typeof(TemplateAttribute).GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);
                        foreach (var property in properties)
                            FindAndReplace(output, string.Format("{0}.{1}", attribute.Name, property.Name), string.Format("%%INSTANCE_ATTRIBUTE_{0}_{1}%%", attribute.Name.ToUpper(), property.Name.ToUpper()));                        
                    }
                   
                    //replace Profile attributes
                    foreach (ProfileAttribute attribute in profile.Attributes.Items)
                    {
                        var properties = typeof(ProfileAttribute).GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);
                        foreach (var property in properties)
                        {
                            if (property.Name.Equals("RuleItems", StringComparison.OrdinalIgnoreCase))
                                continue;

                            FindAndReplace(output, string.Format("{0}.{1}", attribute.Name, property.Name), string.Format("%%PROFILE_ATTRIBUTE_{0}_{1}%%", attribute.Name.ToUpper(), property.Name.ToUpper()));
                        }

                        FindAndReplace(output, string.Format("{0}.Value", attribute.Name), string.Format("%%PROFILE_ATTRIBUTE_{0}_VALUE%%", attribute.Name.ToUpper()));
                    }

                    //find multiline part
                    while (output.ToString().IndexOf("%%MULTI%%", StringComparison.OrdinalIgnoreCase) >= 0 && output.ToString().IndexOf("%%ENDMULTI%%", StringComparison.OrdinalIgnoreCase) >= 0)
                    {                        
                        int startIndex = output.ToString().IndexOf("%%MULTI%%", StringComparison.OrdinalIgnoreCase);
                        int stopIndex = output.ToString().IndexOf("%%ENDMULTI%%", startIndex, StringComparison.OrdinalIgnoreCase);
                        if (startIndex >= 0 && stopIndex > 0)
                        {
                            string textBefore = output.ToString().Substring(0, startIndex);
                            string textMulti = output.ToString().Substring(startIndex + 9, stopIndex - startIndex - 9).TrimStart(new char[] { '\r', '\n' }); //cut %%MULTI%%
                            string textAfter = output.ToString().Substring(stopIndex + 12).TrimStart(new char[] { '\r', '\n' }); //cut %%ENDMULTI%%

                            //insert instances
                            output = new StringBuilder(textBefore);
                            foreach (Instance instance in (selectedInstance != null) ? ParentProxy.CurrentTemplate.Instances.Items.Where(u => u == selectedInstance) : ParentProxy.CurrentTemplate.Instances.Items)
                            {
                                output.Append(string.Format("%%INSTANCE_{0}%%", instance.Id));
                                output.Append(textMulti);
                                output.Append("%%ENDINSTANCE%%");
                            }

                            output.Append(textAfter);
                        }
                    }

                    //second pass - replace tags with actual values
                    //replace Template properties
                    searchItems = new string[] { "%%TEMPLATE_ID%%", "%%TEMPLATE_NAME%%", "%%TEMPLATE_DESCRIPTION%%" };
                    replaceItems = new string[] { ParentProxy.CurrentTemplate.Id.ToString(), ParentProxy.CurrentTemplate.Name, ParentProxy.CurrentTemplate.Description };
                    string[] errorMsgItems = new string[] { "Id", "Name", "Description" };
                    for (int i = 0; i < searchItems.Length; i++)
                    {
                        if (string.IsNullOrEmpty(replaceItems[i]) && _richTextBoxTags.Count(u => u.Text.Equals(string.Format("Template.{0}", errorMsgItems[i]), StringComparison.OrdinalIgnoreCase)) > 0)
                        {
                            MainWindow.ShowMessage("Template: {0}\r\nProperty {1} not found", ParentProxy.CurrentTemplate.Name, errorMsgItems[i]);
                            return;
                        }

                        output.Replace(searchItems[i], replaceItems[i]);
                    }

                    //replace Client properties
                    ProposalClientDetails client = ParentProxy.Project.Proposal.ClientDetails;                    
                    searchItems = new string[] { "%%CLIENT_COMPANY_NAME%%", "%%CLIENT_CONTACT_NAME%%", "%%CLIENT_PHONE%%", "%%CLIENT_EMAIL%%", "%%CLIENT_ADDRESS%%", "%%CLIENT_TAX%%" };
                    replaceItems = new string[] { client.CompanyName, client.ContactName, client.PhoneNumber, client.EmailAddress, client.Address, client.TaxNumber };
                    errorMsgItems = new string[] { "CompanyName", "ContactName", "Phone", "Email", "Address", "Tax" };
                    for (int i = 0; i < searchItems.Length; i++)
                    {
                        if (string.IsNullOrEmpty(replaceItems[i]) && _richTextBoxTags.Count(u => u.Text.Equals(string.Format("Client.{0}", errorMsgItems[i]), StringComparison.OrdinalIgnoreCase)) > 0)
                        {
                            MainWindow.ShowMessage("Client details:\r\nProperty {0} not found", errorMsgItems[i]);
                            return;
                        }

                        output.Replace(searchItems[i], replaceItems[i]);
                    }

                    //replace Proposal properties                    
                    searchItems = new string[] { "%%PROPOSAL_NAME%%", "%%PROPOSAL_DESCRIPTION%%" };
                    replaceItems = new string[] { client.Name, client.Description };
                    errorMsgItems = new string[] { "Name", "Description" };
                    for (int i = 0; i < searchItems.Length; i++)
                    {
                        if (string.IsNullOrEmpty(replaceItems[i]) && _richTextBoxTags.Count(u => u.Text.Equals(string.Format("Proposal.{0}", errorMsgItems[i]), StringComparison.OrdinalIgnoreCase)) > 0)
                        {
                            MainWindow.ShowMessage("Proposal:\r\nProperty {0} not found", errorMsgItems[i]);
                            return;
                        }

                        output.Replace(searchItems[i], replaceItems[i]);
                    }

                    //replace Company properties
                    ProposalConfiguration company = MainWindow.Configuration.Proposal;
                    searchItems = new string[] { "%%COMPANY_COMPANY_NAME%%", "%%COMPANY_CONTACT_NAME%%", "%%COMPANY_PHONE%%", "%%COMPANY_EMAIL%%", "%%COMPANY_ADDRESS%%", "%%COMPANY_TAX%%" };
                    replaceItems = new string[] { company.CompanyName, company.ContactName, company.PhoneNumber, company.EmailAddress, company.Address, company.TaxNumber };
                    errorMsgItems = new string[] { "CompanyName", "ContactName", "Phone", "Email", "Address", "Tax" };
                    for (int i = 0; i < searchItems.Length; i++)
                    {
                        if (string.IsNullOrEmpty(replaceItems[i]) && _richTextBoxTags.Count(u => u.Text.Equals(string.Format("Company.{0}", errorMsgItems[i]), StringComparison.OrdinalIgnoreCase)) > 0)
                        {
                            MainWindow.ShowMessage("Company:\r\nProperty {0} not found", errorMsgItems[i]);
                            return;
                        }

                        output.Replace(searchItems[i], replaceItems[i]);
                    }                                       

                    //parse rules, set values
                    foreach (ProfileAttribute attribute in profile.Attributes.Items)
                    {                        
                        string errorMessage = string.Empty;
                        if (attribute.VerifyRule(ParentProxy.CurrentTemplate.Attributes.Items, ref errorMessage, attribute.Rule, 0, "+") == false)
                        {
                            MainWindow.ShowMessage(errorMessage.Insert(0, attribute.Name + ": "));
                            return;
                        }
                    }

                    //multiline instances
                    bool singleInstance = false;
                    foreach (Instance instance in (selectedInstance != null) ? ParentProxy.CurrentTemplate.Instances.Items.Where(u => u == selectedInstance) : ParentProxy.CurrentTemplate.Instances.Items)
                    {
                        //copy properties from template to instance (name, desc, data type)
                        foreach (AttributeBase attribute in ParentProxy.CurrentTemplate.Attributes.Items)
                            instance.Attributes.Items.Where(u => u.Id == attribute.Id).Single().GetParentsProperties(attribute);

                        //search for INSTANCE tag
                        int startIndex = output.ToString().IndexOf(string.Format("%%INSTANCE_{0}%%", instance.Id), StringComparison.OrdinalIgnoreCase);
                        int stopIndex = startIndex < 0 ? -1 : output.ToString().IndexOf("%%ENDINSTANCE%%", startIndex, StringComparison.OrdinalIgnoreCase);
                        if (startIndex < 0)
                        {
                            startIndex = 0;
                            singleInstance = true;
                        }

                        //find multiline part
                        while (startIndex == 0 || output.ToString().IndexOf(string.Format("%%INSTANCE_{0}%%", instance.Id), StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            //replace Instance properties
                            Area area = Project.Areas.Items.Where(u => u.Instances.Items.Count(x => x == instance) > 0).SingleOrDefault();
                            searchItems = new string[] { "%%INSTANCE_ID%%", "%%INSTANCE_NAME%%", "%%INSTANCE_DESCRIPTION%%", "%%INSTANCE_FLAGGED%%", "%%INSTANCE_AREA_NAME%%", "%%INSTANCE_AREA_DESCRIPTION%%" };
                            replaceItems = new string[] { instance.Id.ToString(), instance.Name, instance.Description, instance.IsFlagged.ToString(), area.Name, area.Description };
                            errorMsgItems = new string[] { "Id", "Name", "Description", "Flagged", "AreaName", "AreaDescription" };
                            for (int i = 0; i < searchItems.Length; i++)
                            {
                                if (searchItems[i].Equals("%%INSTANCE_AREA_DESCRIPTION%%") == false && area.Id != 0) //Unassigned area has no description
                                {
                                    if (string.IsNullOrEmpty(replaceItems[i]) && _richTextBoxTags.Count(u => u.Text.Equals(string.Format("Instance.{0}", errorMsgItems[i]), StringComparison.OrdinalIgnoreCase)) > 0)
                                    {
                                        MainWindow.ShowMessage("Instance: {0}\r\nProperty {1} not found", instance.Name, errorMsgItems[i]);
                                        return;
                                    }
                                }

                                if (stopIndex > 0)
                                {
                                    output.Replace(searchItems[i], replaceItems[i], startIndex, stopIndex - startIndex);
                                    stopIndex = output.ToString().IndexOf("%%ENDINSTANCE%%", startIndex, StringComparison.OrdinalIgnoreCase);
                                }
                                else
                                    output.Replace(searchItems[i], replaceItems[i]);
                            }

                            //replace Template attributes properties
                            foreach (TemplateAttribute attribute in ParentProxy.CurrentTemplate.Attributes.Items)
                            {
                                var instanceAttribute = instance.Attributes.Items.Where(u => u.Name.Equals(attribute.Name, StringComparison.OrdinalIgnoreCase)).FirstOrDefault();
                                if (instanceAttribute == null)
                                    continue;

                                var properties = typeof(InstanceAttribute).GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);
                                foreach (var property in properties)
                                {                                    
                                    string value = string.Empty;
                                    if (property.Name.Equals("DataType", StringComparison.OrdinalIgnoreCase))
                                    {
                                        int id = Convert.ToInt32(property.GetValue(instanceAttribute));
                                        value = ParentProxy.DataTypes.Where(u => u.Id == id).Single().Name;
                                    }
                                    else
                                        value = property.GetValue(instanceAttribute) != null ? property.GetValue(instanceAttribute).ToString() : string.Empty;

                                    if (string.IsNullOrEmpty(value) && _richTextBoxTags.Count(u => u.Text.Equals(string.Format("{0}.{1}", instanceAttribute.Name, property.Name), StringComparison.OrdinalIgnoreCase)) > 0)
                                    {                                        
                                        MainWindow.ShowMessage("Instance: {0}\r\nAttribute {1} not found", instance.Name, property.Name);
                                        return;
                                    }

                                    if (stopIndex > 0)
                                    {
                                        output.Replace(string.Format("%%INSTANCE_ATTRIBUTE_{0}_{1}%%", attribute.Name.ToUpper(), property.Name.ToUpper()), value, startIndex, stopIndex - startIndex);
                                        stopIndex = output.ToString().IndexOf("%%ENDINSTANCE%%", startIndex, StringComparison.OrdinalIgnoreCase);
                                    }
                                    else
                                        output.Replace(string.Format("%%INSTANCE_ATTRIBUTE_{0}_{1}%%", attribute.Name.ToUpper(), property.Name.ToUpper()), value);                                    
                                }
                            }

                            //replace Profile attributes
                            foreach (ProfileAttribute attribute in profile.Attributes.Items)
                            {
                                var profileAttribute = profile.Attributes.Items.Where(u => u.Name.Equals(attribute.Name, StringComparison.OrdinalIgnoreCase)).FirstOrDefault();
                                if (profileAttribute == null)
                                    continue;

                                var properties = typeof(ProfileAttribute).GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);
                                foreach (var property in properties)
                                {
                                    if (property.Name.Equals("RuleItems", StringComparison.OrdinalIgnoreCase))
                                        continue;

                                    string value = string.Empty;
                                    if (property.Name.Equals("DataType", StringComparison.OrdinalIgnoreCase))
                                    {
                                        int id = Convert.ToInt32(property.GetValue(profileAttribute));
                                        value = ParentProxy.DataTypes.Where(u => u.Id == id).Single().Name;
                                    }
                                    else
                                    {
                                        object o = property.GetValue(profileAttribute);
                                        value = o != null ? o.ToString() : string.Empty;
                                    }

                                    if (string.IsNullOrEmpty(value) && _richTextBoxTags.Count(u => u.Text.Equals(string.Format("{0}.{1}", attribute.Name, property.Name), StringComparison.OrdinalIgnoreCase)) > 0)
                                    {
                                        MainWindow.ShowMessage("Profile attribute {0}\r\n{1} value not found", attribute.Name, property.Name);
                                        return;
                                    }

                                    if (stopIndex > 0)
                                    {
                                        output.Replace(string.Format("%%PROFILE_ATTRIBUTE_{0}_{1}%%", attribute.Name.ToUpper(), property.Name.ToUpper()), value, startIndex, stopIndex - startIndex);
                                        stopIndex = output.ToString().IndexOf("%%ENDINSTANCE%%", startIndex, StringComparison.OrdinalIgnoreCase);
                                    }
                                    else
                                        output.Replace(string.Format("%%PROFILE_ATTRIBUTE_{0}_{1}%%", attribute.Name.ToUpper(), property.Name.ToUpper()), value);
                                }

                                //replace Value
                                StringBuilder ruleValue = new StringBuilder();
                                if (AddAttributeValue_String(attribute, instance, ruleValue, string.Empty) == false)
                                    return;

                                if (AddAttributeValue_Number(attribute, instance, ruleValue, string.Empty) == false)
                                    return;

                                if (AddAttributeValue_Boolean(attribute, instance, ruleValue, string.Empty) == false)
                                    return;
                               
                                if (stopIndex > 0)
                                {
                                    output.Replace(string.Format("%%PROFILE_ATTRIBUTE_{0}_VALUE%%", attribute.Name.ToUpper()), ruleValue.ToString(), startIndex, stopIndex - startIndex);
                                    stopIndex = output.ToString().IndexOf("%%ENDINSTANCE%%", startIndex, StringComparison.OrdinalIgnoreCase);
                                }
                                else
                                    output.Replace(string.Format("%%PROFILE_ATTRIBUTE_{0}_VALUE%%", attribute.Name.ToUpper()), ruleValue.ToString());
                            }                            

                            //remove INSTANCE tags                            
                            if (stopIndex > 0)
                            {
                                output.Replace(string.Format("%%INSTANCE_{0}%%", instance.Id), string.Empty, startIndex, stopIndex - startIndex);
                                stopIndex = output.ToString().IndexOf("%%ENDINSTANCE%%", startIndex, StringComparison.OrdinalIgnoreCase);
                                output.Replace("%%ENDINSTANCE%%", string.Empty, startIndex, stopIndex - startIndex + 15);

                                //search for next INSTANCE tag
                                if (startIndex < output.ToString().Length)
                                {
                                    startIndex = output.ToString().IndexOf(string.Format("%%INSTANCE_{0}%%", instance.Id), startIndex + 1, StringComparison.OrdinalIgnoreCase);

                                    if (startIndex >= 0)
                                        stopIndex = output.ToString().IndexOf("%%ENDINSTANCE%%", startIndex, StringComparison.OrdinalIgnoreCase);
                                }
                            }
                            else
                                break; //exit while instance loop
                        }

                        if (singleInstance)
                            break; //exit foreach instance loop
                    }
                    
                    writer.Write(output);

                    writer.Close();
                }
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void FindAndReplace(StringBuilder output, string search, string replacement)
        { 
            try
            {
                int index = 0;
                while (index >= 0)
                {
                    //find searched text
                    index = output.ToString().IndexOf(search, index + 1, StringComparison.OrdinalIgnoreCase);
                    if (index > 0 && index < output.ToString().Length)
                    {             
                        //check if it starts and ends with valid chars
                        string charBefore = output.ToString()[index - 1].ToString();
                        string charAfter = output.ToString()[index + search.Length].ToString();
                        string invalidChars =@"[a-zA-Z0-9_%.]";

                        if (Regex.IsMatch(charBefore, invalidChars) == false && Regex.IsMatch(charAfter, invalidChars) == false)
                        {
                            output.Remove(index, search.Length);
                            output.Insert(index, replacement);
                        }
                    }
                }
            }
            catch(Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private bool IsValidTag(string text, string search, int index)
        {
            if (index <= 0 || index >= text.Length)
                return false;

            try
            {                                                   
                //check if it starts and ends with valid chars
                string charBefore = text[index - 1].ToString();
                string charAfter = text[index + search.Length].ToString();
                string invalidChars = @"[a-zA-Z0-9_%.]";

                if (Regex.IsMatch(charBefore, invalidChars) == false && Regex.IsMatch(charAfter, invalidChars) == false)
                    return true;                                                    
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }

            return false;
        }

        private bool AddAttributeValue_String(ProfileAttribute attribute, Instance instance, StringBuilder line, string delimiter)
        {
            try
            {
                if (attribute.DataType != DataTypes.String)
                    return true;

                StringBuilder result = new StringBuilder();
                foreach (ProfileAttributeRuleItem item in attribute.RuleItems)
                {
                    //add instance attribute value
                    if (item.Type == ProfileAttributeRuleItem.Types.Attribute)
                    {
                        var instanceAttribute = instance.Attributes.Items.Where(u => u.Name.Equals(item.Value, StringComparison.OrdinalIgnoreCase)).FirstOrDefault();

                        if (instanceAttribute == null)
                        {
                            MainWindow.ShowMessage("Instance: {0}\r\nAttribute {1} not found", instance.Name, item.Value);
                            return false;
                        }

                        if (string.IsNullOrEmpty(instanceAttribute.Value))
                        {
                            MainWindow.ShowMessage("Instance: {0}\r\nAttribute: {1}\r\nValue not found", instance.Name, item.Value);
                            return false;
                        }

                        result.Append(instanceAttribute.Value);
                        continue;
                    }

                    //add Template or Instance property (Id, Name, Description)
                    if (item.Type == ProfileAttributeRuleItem.Types.TemplateInstanceProperty)
                    {
                        //replace Template properties
                        string[] searchItems = new string[] { "Template.Id", "Template.Name", "Template.Description" };
                        string[] replaceItems = new string[] { ParentProxy.CurrentTemplate.Id.ToString(), ParentProxy.CurrentTemplate.Name, ParentProxy.CurrentTemplate.Description };
                        for (int i = 0; i < searchItems.Length; i++)
                        {
                            if (item.Value.Equals(searchItems[i], StringComparison.OrdinalIgnoreCase))
                                result.Append(replaceItems[i]);                   
                        }                            

                        //replace Instance properties
                        Area area = Project.Areas.Items.Where(u => u.Instances.Items.Count(x => x == instance) > 0).SingleOrDefault();                        
                        searchItems = new string[] { "Instance.Id", "Instance.Name", "Instance.Description", "Instance.Flagged", "Instance.AreaName", "Instance.AreaDescription" };
                        replaceItems = new string[] { instance.Id.ToString(), instance.Name, instance.Description, instance.IsFlagged.ToString(), area.Name, area.Description };
                        for (int i = 0; i < searchItems.Length; i++)
                        {
                            if (item.Value.Equals(searchItems[i], StringComparison.OrdinalIgnoreCase))
                                result.Append(replaceItems[i]);
                        }                       
                    }

                    //add Client property 
                    if (item.Type == ProfileAttributeRuleItem.Types.ClientProperty)
                    {
                        //replace properties
                        ProposalClientDetails details = ParentProxy.Project.Proposal.ClientDetails;
                        string[] searchItems = new string[] { "Client.CompanyName", "Client.ContactName", "Client.Phone", "Client.Email", "Client.Address", "Client.Tax" };
                        string[] replaceItems = new string[] { details.CompanyName, details.ContactName, details.PhoneNumber, details.EmailAddress, details.Address, details.TaxNumber };
                        for (int i = 0; i < searchItems.Length; i++)
                        {
                            if (item.Value.Equals(searchItems[i], StringComparison.OrdinalIgnoreCase))
                                result.Append(replaceItems[i]);
                        }
                    }

                    //add Client property 
                    if (item.Type == ProfileAttributeRuleItem.Types.ProposalProperty)
                    {
                        //replace properties
                        ProposalClientDetails details = ParentProxy.Project.Proposal.ClientDetails;
                        string[] searchItems = new string[] { "Proposal.Name", "Proposal.Description" };
                        string[] replaceItems = new string[] { details.Name, details.Description };
                        for (int i = 0; i < searchItems.Length; i++)
                        {
                            if (item.Value.Equals(searchItems[i], StringComparison.OrdinalIgnoreCase))
                                result.Append(replaceItems[i]);
                        }
                    }

                    //add Company property 
                    if (item.Type == ProfileAttributeRuleItem.Types.CompanyProperty)
                    {
                        //replace properties                        
                        ProposalConfiguration details = MainWindow.Configuration.Proposal;
                        string[] searchItems = new string[] { "Company.CompanyName", "Company.ContactName", "Company.Phone", "Company.Email", "Company.Address", "Company.Tax" };
                        string[] replaceItems = new string[] { details.CompanyName, details.ContactName, details.PhoneNumber, details.EmailAddress, details.Address, details.TaxNumber };
                        for (int i = 0; i < searchItems.Length; i++)
                        {
                            if (item.Value.Equals(searchItems[i], StringComparison.OrdinalIgnoreCase))
                                result.Append(replaceItems[i]);
                        }
                    }

                    //add Attribute property (Id, Name, Description, DataType, Value)
                    if (item.Type == ProfileAttributeRuleItem.Types.AttributeProperty)
                    {
                        string[] array = item.Value.Split(new char[] { '.' }, StringSplitOptions.RemoveEmptyEntries);
                        if (array.Length != 2)
                        {
                            MainWindow.ShowMessage("Instance: {0}\r\nAttribute: {1}\r\nUnrecognized attribute", instance.Name, item.Value);
                            return false;
                        }

                        var instanceAttribute = instance.Attributes.Items.Where(u => u.Name.Equals(array[0], StringComparison.OrdinalIgnoreCase)).FirstOrDefault();
                        if (instanceAttribute == null)
                        {
                            MainWindow.ShowMessage("Instance: {0}\r\nAttribute {1} not found", instance.Name, item.Value);
                            return false;
                        }

                        if (string.IsNullOrEmpty(instanceAttribute.Value))
                        {
                            MainWindow.ShowMessage("Instance: {0}\r\nAttribute: {1}\r\nValue not found", instance.Name, item.Value);
                            return false;
                        }                     

                        var properties = typeof(InstanceAttribute).GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);
                        var property = properties.Where(u => u.Name.Equals(array[1], StringComparison.OrdinalIgnoreCase)).FirstOrDefault();
                        if (property == null)
                        {
                            MainWindow.ShowMessage("Instance: {0}\r\nAttribute: {1}\r\nProperty not found", instance.Name, item.Value);
                            return false;
                        }

                        if (property.Name.Equals("DataType", StringComparison.OrdinalIgnoreCase))
                        {
                            int id = Convert.ToInt32(property.GetValue(instanceAttribute));
                            result.Append(ParentProxy.DataTypes.Where(u => u.Id == id).Single().Name);
                        }
                        else
                            result.Append(property.GetValue(instanceAttribute));                             
                    }

                    //add string
                    if (item.Type == ProfileAttributeRuleItem.Types.String)
                        result.Append(item.Value);
                }

                line.Append(result.ToString()).Append(delimiter);
                return true;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
                return false;
            }
        }

        private bool AddAttributeValue_Boolean(ProfileAttribute attribute, Instance instance, StringBuilder line, string delimiter)
        {
            try
            {
                if (attribute.DataType != DataTypes.Bool)
                    return true;

                bool result = false;
                string bitOperator = "or";
                bool reverse = false;

                foreach (ProfileAttributeRuleItem item in attribute.RuleItems)
                {
                    //add instance attribute value
                    if (item.Type == ProfileAttributeRuleItem.Types.Attribute)
                    {
                        var instanceAttribute = instance.Attributes.Items.Where(u => u.Name.Equals(item.Value, StringComparison.OrdinalIgnoreCase)).FirstOrDefault();

                        if (instanceAttribute == null)
                        {
                            MainWindow.ShowMessage("Instance: {0}\r\nAttribute {1} not found", instance.Name, item.Value);
                            return false;
                        }

                        if (string.IsNullOrEmpty(instanceAttribute.Value))
                        {
                            MainWindow.ShowMessage("Instance: {0}\r\nAttribute: {1}\r\nValue not found", instance.Name, item.Value);
                            return false;
                        }

                        bool value = false;
                        if (Boolean.TryParse(instanceAttribute.Value, out value) == false)
                        {
                            int v = 0;
                            if (Int32.TryParse(instanceAttribute.Value, out v) == false)
                            {
                                MainWindow.ShowMessage("Instance: {0}\r\nAttribute: {1}\r\nIncorrect value. Boolean epected", instance.Name, item.Value);
                                return false;
                            }
                            else
                                value = Convert.ToBoolean(v);
                        }

                        DoBitwise(ref result, value, bitOperator, ref reverse);
                        continue;
                    }

                    //add Template or Instance property (Id, Name, Description)
                    if (item.Type == ProfileAttributeRuleItem.Types.TemplateInstanceProperty)
                    {
                        if (item.Value.Equals("Instance.Flagged", StringComparison.OrdinalIgnoreCase))
                        {
                            DoBitwise(ref result, instance.IsFlagged, bitOperator, ref reverse);
                            continue;
                        }
                    }

                    //add Attribute property (Value)
                    if (item.Type == ProfileAttributeRuleItem.Types.AttributeProperty)
                    {
                        string[] array = item.Value.Split(new char[] { '.' }, StringSplitOptions.RemoveEmptyEntries);
                        if (array.Length != 2)
                        {
                            MainWindow.ShowMessage("Instance: {0}\r\nAttribute: {1}\r\nUnrecognized attribute", instance.Name, item.Value);
                            return false;
                        }

                        var templateAttribute = ParentProxy.CurrentTemplate.Attributes.Items.Where(u => u.Name.Equals(array[0], StringComparison.OrdinalIgnoreCase)).FirstOrDefault();
                        if (templateAttribute == null)
                        {
                            MainWindow.ShowMessage("Instance: {0}\r\nAttribute: {1}\r\nInput attribute not found", instance.Name, item.Value);
                            return false;
                        }

                        var properties = typeof(TemplateAttribute).GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);
                        var property = properties.Where(u => u.Name.Equals(array[1], StringComparison.OrdinalIgnoreCase)).FirstOrDefault();
                        if (property == null)
                        {
                            MainWindow.ShowMessage("Instance: {0}\r\nAttribute: {1}\r\nProperty not found", instance.Name, item.Value);
                            return false;
                        }

                        bool value = false;
                        if (Boolean.TryParse(property.GetValue(templateAttribute).ToString(), out value) == false)
                        {
                            int v = 0;
                            if (Int32.TryParse(property.GetValue(templateAttribute).ToString(), out v) == false)
                            {
                                MainWindow.ShowMessage("Instance: {0}\r\nAttribute: {1}\r\nIncorrect value. Boolean epected", instance.Name, item.Value);
                                return false;
                            }
                            else
                                value = Convert.ToBoolean(v);
                        }

                        DoBitwise(ref result, value, bitOperator, ref reverse);
                        continue;
                    }

                    //set operator
                    if (item.Type == ProfileAttributeRuleItem.Types.Operator)
                    {
                        if (item.Value.Equals("not", StringComparison.OrdinalIgnoreCase))
                            reverse = true;
                        else
                            bitOperator = item.Value;
                    }
                }

                line.Append(result.ToString()).Append(delimiter);
                return true;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
                return false;
            }
        }

        private void DoBitwise(ref bool value, bool newValue, string bitOperator, ref bool reverse)
        {
            if (reverse)
            {
                newValue = !newValue;
                reverse = false;
            }

            switch (bitOperator.ToLower())
            {
                case "or":
                    value |= newValue;
                    break;
                case "xor":
                    value ^= newValue;
                    break;
                case "and":
                    value &= newValue;
                    break;
            }
        }

        private bool AddAttributeValue_Number(ProfileAttribute attribute, Instance instance, StringBuilder line, string delimiter)
        {
            try
            {
                if (attribute.DataType < DataTypes.Int_8 || attribute.DataType > DataTypes.Float)
                    return true;

                //math operations are made on 2 loop passes
                //set rule items signification (set if item should be proceeded on first or second pass) 
                attribute.SetRuleItemsSignification();

                double result = 0;
                List<ProfileAttributeRuleItem> secondPassRuleItems = new List<ProfileAttributeRuleItem>();

                //first pass for multiplication and division, second addition and substraction
                for (int pass = 0; pass < 2; pass++)
                {
                    bool resultValid = false;
                    string mathOperator = "+";
                    result = 0;

                    //first pass get Rule items, second get items created in first pass
                    foreach (ProfileAttributeRuleItem item in (pass == 0) ? attribute.RuleItems : secondPassRuleItems)
                    {
                        //add instance attribute value
                        if (item.Type == ProfileAttributeRuleItem.Types.Attribute)
                        {
                            var instanceAttribute = instance.Attributes.Items.Where(u => u.Name.Equals(item.Value, StringComparison.OrdinalIgnoreCase)).FirstOrDefault();

                            if (instanceAttribute == null)
                            {
                                MainWindow.ShowMessage("Instance: {0}\r\nAttribute {1} not found", instance.Name, item.Value);
                                return false;
                            }

                            if (string.IsNullOrEmpty(instanceAttribute.Value))
                            {
                                MainWindow.ShowMessage("Instance: {0}\r\nAttribute: {1}\r\nValue not found", instance.Name, item.Value);
                                return false;
                            }

                            double value = 0;
                            if (double.TryParse(instanceAttribute.Value, System.Globalization.NumberStyles.Any, CultureInfo.InvariantCulture, out value) == false)
                            {
                                MainWindow.ShowMessage("Instance: {0}\r\nAttribute: {1}\r\nIncorrect value. Number epected", instance.Name, item.Value);
                                return false;
                            }

                            if ((pass == 0 && item.IsMathPrime) || pass == 1)
                            {
                                DoMath(mathOperator, value, ref result);
                                resultValid = true;
                            }
                            else
                                secondPassRuleItems.Add(new ProfileAttributeRuleItem(item)); //first pass, copy item for 2nd pass

                            continue;
                        }

                        //add Template or Instance property (Id, Name, Description)
                        if (item.Type == ProfileAttributeRuleItem.Types.TemplateInstanceProperty)
                        {
                            //replace Template properties (Id)                            
                            if (item.Value.Equals("Template.Id", StringComparison.OrdinalIgnoreCase))
                            {
                                if ((pass == 0 && item.IsMathPrime) || pass == 1)
                                {
                                    DoMath(mathOperator, ParentProxy.CurrentTemplate.Id, ref result);
                                    resultValid = true;
                                }
                                else
                                    secondPassRuleItems.Add(new ProfileAttributeRuleItem(item)); //first pass, copy item for 2nd pass
                            }

                            //replace Instance properties (Id)  
                            if (item.Value.Equals("Instance.Id", StringComparison.OrdinalIgnoreCase))
                            {
                                if ((pass == 0 && item.IsMathPrime) || pass == 1)
                                {
                                    DoMath(mathOperator, instance.Id, ref result);
                                    resultValid = true;
                                }
                                else
                                    secondPassRuleItems.Add(new ProfileAttributeRuleItem(item)); //first pass, copy item for 2nd pass
                            }                           
                        }

                        //add Attribute property (Id, Name, Description, DataType, Value)
                        if (item.Type == ProfileAttributeRuleItem.Types.AttributeProperty)
                        {
                            string[] array = item.Value.Split(new char[] { '.' }, StringSplitOptions.RemoveEmptyEntries);
                            if (array.Length != 2)
                            {
                                MainWindow.ShowMessage("Instance: {0}\r\nAttribute: {1}\r\nUnrecognized attribute", instance.Name, item.Value);
                                return false;
                            }

                            var templateAttribute = ParentProxy.CurrentTemplate.Attributes.Items.Where(u => u.Name.Equals(array[0], StringComparison.OrdinalIgnoreCase)).FirstOrDefault();
                            if (templateAttribute == null)
                            {
                                MainWindow.ShowMessage("Instance: {0}\r\nAttribute: {1}\r\nInput attribute not found", instance.Name, item.Value);
                                return false;
                            }

                            var properties = typeof(TemplateAttribute).GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);
                            var property = properties.Where(u => u.Name.Equals(array[1], StringComparison.OrdinalIgnoreCase)).FirstOrDefault();
                            if (property == null)
                            {
                                MainWindow.ShowMessage("Instance: {0}\r\nAttribute: {1}\r\nProperty not found", instance.Name, item.Value);
                                return false;
                            }

                            double value = 0;
                            if (property.GetValue(templateAttribute) == null || double.TryParse(property.GetValue(templateAttribute).ToString(), System.Globalization.NumberStyles.Any, CultureInfo.InvariantCulture, out value) == false)
                            {
                                MainWindow.ShowMessage("Instance: {0}\r\nAttribute: {1}\r\nIncorrect value. Number epected", instance.Name, item.Value);
                                return false;
                            }

                            if ((pass == 0 && item.IsMathPrime) || pass == 1)
                            {
                                DoMath(mathOperator, value, ref result);
                                resultValid = true;
                            }
                            else
                                secondPassRuleItems.Add(new ProfileAttributeRuleItem(item)); //first pass, copy item for 2nd pass

                            continue;
                        }

                        //add number
                        if (item.Type == ProfileAttributeRuleItem.Types.Number)
                        {
                            double value = 0;
                            if (double.TryParse(item.Value, System.Globalization.NumberStyles.Any, CultureInfo.InvariantCulture, out value) == false)
                            {
                                MainWindow.ShowMessage("Profile attribute: {0}\r\nIncorrect rule item value. Number epected", attribute.Name);
                                return false;
                            }

                            if ((pass == 0 && item.IsMathPrime) || pass == 1)
                            {
                                DoMath(mathOperator, value, ref result);
                                resultValid = true;
                            }
                            else
                                secondPassRuleItems.Add(new ProfileAttributeRuleItem(item));

                            continue;
                        }

                        //set operator
                        if (item.Type == ProfileAttributeRuleItem.Types.Operator)
                        {
                            if ((pass == 0 && item.IsMathPrime) || pass == 1)
                                mathOperator = item.Value;
                            else
                            {
                                if (resultValid)
                                {
                                    secondPassRuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.Number, Value = result.ToString(CultureInfo.InvariantCulture) });
                                    mathOperator = "+";
                                    resultValid = false;
                                    result = 0;
                                }

                                secondPassRuleItems.Add(new ProfileAttributeRuleItem(item));
                            }
                        }
                    }

                    //last item on first pass
                    if (resultValid)
                        secondPassRuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.Number, Value = result.ToString(CultureInfo.InvariantCulture) });
                }

                //cast result on atrribute's data type
                switch (attribute.DataType)
                {
                    case DataTypes.Int_8:
                        result = Convert.ToSByte(result);
                        break;
                    case DataTypes.Int_16:
                        result = Convert.ToInt16(result);
                        break;
                    case DataTypes.Int_32:
                        result = Convert.ToInt32(result);
                        break;
                    case DataTypes.UInt_8:
                        result = Convert.ToByte(result);
                        break;
                    case DataTypes.UInt_16:
                        result = Convert.ToUInt16(result);
                        break;
                    case DataTypes.UInt_32:
                        result = Convert.ToUInt32(result);
                        break;
                    case DataTypes.Float:
                        result = Convert.ToSingle(result);
                        break;
                }

                line.Append(result.ToString(CultureInfo.InvariantCulture)).Append(delimiter);
                return true;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
                return false;
            }
        }

        private void DoMath(string mathOperator, double newValue, ref double value)
        {
            switch (mathOperator)
            {
                case "*":
                    value *= newValue;
                    break;
                case "/":
                    value /= newValue;
                    break;
                case "+":
                    value += newValue;
                    break;
                case "-":
                    value -= newValue;
                    break;
            }
        }                

        private void CheckWordsInRun(Run run, string text, string[] keywords, bool isMulti = false)
        {
            if (keywords == null || keywords.Length == 0)
                return;

            int startIndex = 0;
            int stopIndex = 0;
            string invalidChars = @"[a-zA-Z0-9_%.]";

            //go through Run and save keywords positions
            for (int i = 0; i < text.Length; i++)
            {
                if (Char.IsWhiteSpace(text[i]) || Regex.IsMatch(text[i].ToString(), invalidChars) == false)
                {
                    if (i > 0 && !(Char.IsWhiteSpace(text[i - 1]) || Regex.IsMatch(text[i - 1].ToString(), invalidChars) == false))
                    {
                        stopIndex = i - 1;
                        string word = text.Substring(startIndex, stopIndex - startIndex + 1);
                        if (keywords.Count(u => u.Equals(word, StringComparison.OrdinalIgnoreCase)) > 0)
                        {
                            RichTextBoxTag tag = new RichTextBoxTag();
                            tag.StartPosition = run.ContentStart.GetPositionAtOffset(startIndex, LogicalDirection.Forward);
                            tag.EndPosition = run.ContentStart.GetPositionAtOffset(stopIndex + 1, LogicalDirection.Backward);
                            tag.IsMulti = isMulti;
                            tag.Text = word;
                            _richTextBoxTags.Add(tag);
                        }
                    }

                    startIndex = i + 1;
                }
            }

            //repeat for last word
            string lastWord = text.Substring(startIndex, text.Length - startIndex);
            if (keywords.Count(u => u.Equals(lastWord, StringComparison.OrdinalIgnoreCase)) > 0)
            {
                RichTextBoxTag tag = new RichTextBoxTag();
                tag.StartPosition = run.ContentStart.GetPositionAtOffset(startIndex, LogicalDirection.Forward);
                tag.EndPosition = run.ContentStart.GetPositionAtOffset(text.Length, LogicalDirection.Backward);
                tag.IsMulti = isMulti;
                _richTextBoxTags.Add(tag);
            }
        }  
        
        public void LoadRichTextBoxDocument()
        {
            try
            {
                FlowDocument document = new FlowDocument();
                Paragraph paragraph = new Paragraph();

                if (_profile.ExportType == ProfileExportTypes.Structural)
                {
                    paragraph.Inlines.Add(new Run(_profile.StructuralExportTemplate));

                    //reload Template attributes keywords for syntax highlighting
                    var properties = typeof(TemplateAttribute).GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);
                    _templateAttributesKeywords = new string[ParentProxy.CurrentTemplate.Attributes.Items.Count * properties.Length];
                    int i = 0;

                    foreach (TemplateAttribute attribute in ParentProxy.CurrentTemplate.Attributes.Items)
                    {
                        foreach (var property in properties)
                            _templateAttributesKeywords[i++] = string.Format("{0}.{1}", attribute.Name, property.Name);
                    }

                    //reload Profile attributes keywords for syntax highlighting
                    if (ParentProxy.CurrentProfile != null)
                    {
                        properties = typeof(ProfileAttribute).GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);

                        _profileAttributesKeywords = new string[ParentProxy.CurrentProfile.Attributes.Items.Count * properties.Length]; //skip RuleItems, but include Value which is not in class
                        i = 0;
                        foreach (ProfileAttribute attribute in ParentProxy.CurrentProfile.Attributes.Items)
                        {
                            foreach (var property in properties)
                            {
                                //skip RuleItems
                                if (property.Name.Equals("RuleItems", StringComparison.OrdinalIgnoreCase))
                                    continue;

                                _profileAttributesKeywords[i++] = string.Format("{0}.{1}", attribute.Name, property.Name);
                            }

                            _profileAttributesKeywords[i++] = string.Format("{0}.Value", attribute.Name);
                        }
                    }
                }
                else
                {
                    StringBuilder text = new StringBuilder();
                    foreach (ProfileAttribute attribute in _profile.Attributes.Items.OrderBy(u => u.Id))
                        text.Append(attribute.Name).Append(_profile.TabularExportDelimiter);

                    paragraph.Inlines.Add(new Run(text.ToString()));
                }                

                document.Blocks.Add(paragraph);
                _richTextBox.Document = document;
            }
            catch(Exception ex)
            {
                gLog.Error(ex.ToString());
            }                      
        }

        #endregion

        
    }
}
