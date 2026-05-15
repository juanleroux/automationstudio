using gTools.Log;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
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
//using Microsoft.Win32

namespace TagCreator
{
    /// <summary>
    /// Interaction logic for APISettingsControl.xaml
    /// </summary>
    public partial class APISettingsControl : UserControl, INotifyPropertyChanged
    {
        #region Initialization

        public event PropertyChangedEventHandler PropertyChanged;

        public APISettingsControl()
        {
            InitializeComponent();

            this.DataContext = this;
        }

        #endregion

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

        public string FolderPath
        {
            get
            {
                return Project.Engineering.FolderPath;
            }
            set
            {
                Project.Engineering.FolderPath = value;
                NotifyPropertyChanged("FolderPath");
            }
        }

		public bool EnableIgnitionMenuItems
		{
			get
			{
				return Project.Engineering.EnableIgnitionMenuItems;
			}
			set
			{
				Project.Engineering.EnableIgnitionMenuItems = value;
				NotifyPropertyChanged("EnableIgnitionMenuItems");
			}
		}

		public string IgnitionGateway
		{
			get
			{
				return Project.Engineering.IgnitionGateway;
			}
			set
			{
				Project.Engineering.IgnitionGateway = value;
				NotifyPropertyChanged("IgnitionGateway");
			}
		}

		public string APIKey
		{
			get
			{
				return Project.Engineering.APIKey;
			}
			set
			{
				Project.Engineering.APIKey = value;
				NotifyPropertyChanged("APIKey");
			}
		}

		#region Events

		private void UserControl_Unloaded(object sender, RoutedEventArgs e)
        {
            MainWindow.Configuration.Save();
        }
        
        private void SetFolderButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                System.Windows.Forms.FolderBrowserDialog folderDialog = new System.Windows.Forms.FolderBrowserDialog();
                folderDialog.SelectedPath = FolderPath;

                if (folderDialog.ShowDialog() != System.Windows.Forms.DialogResult.OK)
                    return;

                FolderPath = folderDialog.SelectedPath;                
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

		// Checks Ignition gateway connection when button is clicked.
		private async void CheckGatewayConnection_Click(object sender, RoutedEventArgs e)
		{
			string gatewayUrl = _ignitionGatewayTextBox.Text.Trim().TrimEnd('/') + "/system/gwinfo";

			IgnitionAPI api = new IgnitionAPI();
			api.CheckGatewayConnection_Click(gatewayUrl);
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

        #endregion        
    }
}
